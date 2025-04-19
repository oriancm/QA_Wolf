const { chromium } = require("playwright");
const fs = require("fs/promises");

async function sortHackerNewsArticles() {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Go to Hacker News
    await page.goto("https://news.ycombinator.com/newest", {
      waitUntil: "domcontentloaded",
    });

    const articles = [];

    // Collect the first 100 articles
    while (articles.length < 100) {
      // Wait for articles to be visible
      await page.waitForSelector("tr.athing", { state: "visible", timeout: 10000 });

      // Get all article rows stored in <tr class="athing">
      const rows = await page.$$("tr.athing");

      // Extract article data
      for (const row of rows) {
        const id = await row.getAttribute("id");
        const title = await row.$(".titleline a").then((el) => el?.innerText());
        const metadataRow = await row.evaluateHandle((el) => el.nextElementSibling);
        const ageElement = await metadataRow.$("span.age a") || await metadataRow.$("span.age");
        const ageText = await ageElement?.innerText();

        // Check missing data
        if (!id || !title || !ageText) {
          throw new Error("Missing article data (id, title, or age)");
        }

        articles.push({ index: articles.length, id, title, age: ageText });

        // Break if we have 100 articles
        if (articles.length >= 100) break;
      }

      // If less than 100 articles load more
      if (articles.length < 100) {
        const moreButton = await page.$("a.morelink");
        if (!moreButton) {
          throw new Error("No 'More' button available");
        }
        await moreButton.click();
        // Wait for new articles to load
        await page.waitForSelector("tr.athing", { state: "visible", timeout: 10000 });
      }
    }

    // Check 100 articles
    if (articles.length !== 100) {
      throw new Error(`Expected exactly 100 articles, but found ${articles.length}`);
    }

    // Write articles to JSON file
    await fs.writeFile("articles.json", JSON.stringify(articles, null, 2));

    // Function to convert age text to minutes (e.g., "2 hours ago" -> 120)
    function parseAgeToMinutes(ageText) {
      const match = ageText.match(/^(\d+)\s*(minute|hour|day)/i);
      if (!match) {
        throw new Error(`Invalid age format: ${ageText}`);
      }
      const [_, value, unit] = match;
      const num = parseInt(value);
      if (unit.toLowerCase().includes("minute")) return num;
      if (unit.toLowerCase().includes("hour")) return num * 60;
      if (unit.toLowerCase().includes("day")) return num * 60 * 24;
      return Infinity; // Fallback for unexpected cases
    }

    // Check if articles are sorted
    const minutes = articles.map(({ age }) => parseAgeToMinutes(age));
    for (let i = 0; i < minutes.length - 1; i++) {
      if (minutes[i] > minutes[i + 1]) {
        throw new Error(
          `Articles are not sorted correctly at index ${i}: ${articles[i].age} is older than ${
            articles[i + 1].age
          }`
        );
      }
    }

    console.log("Success: 100 articles sorted newest to oldest, saved to articles.json");
  } catch (error) {
    console.error("Validation failed:", error.message);
    throw error;
  } finally {
    // await browser.close();
  }
}

(async () => {
  await sortHackerNewsArticles();
})();
