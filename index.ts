import puppeteer from "puppeteer";
import { user, password, otp, discordwebhook } from "./secrets.json"
import { authenticator } from 'otplib';
import { Database } from "bun:sqlite";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function initialize_db() {
  const db = new Database("posts.sqlite")
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    title TEXT, 
    genre TEXT, 
    body TEXT,
    sender TEXT,
    date TEXT
  )`)
  return db
}

type MessageContext = { genre: string, title: string, body: string };

async function send_discord_message({ genre, title, body }: MessageContext) {
  const color = genre.includes("全") ? 15607317 : genre.includes("府") ? 389400 : genre.includes("小") ? 41968 : 10658466;
  const res = await fetch(discordwebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "content": "",
      "embeds": [
        {
          "title": title,
          "description": body,
          "color": color
        }
      ],
      "username": "SIRIUS " + genre,
      "attachments": []
    })
  })
  if (res.status === 200) {
    console.error("discord send success")
  } else {
    console.error("discord send error", res.status, await res.text())
  }
  await sleep(1000)
}

const getPosts = async () => {
  // Start a Puppeteer session with:
  // - a visible browser (`headless: false` - easier to debug because you'll see the browser in action)
  // - no default viewport (`defaultViewport: null` - website page will in full width and height)
  const browser = await puppeteer.launch({
    headless: (process.env["SIRIUS_SCRAPE_HEADLESS"] ?? "true") == "false" ? false : true,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const db = initialize_db()

  // Open a new page
  const page = await browser.newPage();

  // On this new page:
  // - open the "http://quotes.toscrape.com/" website
  // - wait until the dom content is loaded (HTML is ready)
  await page.goto("https://web.sirius.tuat.ac.jp", {
    waitUntil: "domcontentloaded",
  });

  // authentication----------------------------
  await page.locator('#identifier').fill(user);
  await page.locator('button').click();
  await page.locator('#password').fill(password);
  await page.locator('button').click();
  await page.locator("#totp-form-selector").click()
  await page.locator("#totp").fill(authenticator.generate(otp));
  await page.locator("button[type=submit]").click();

  // sirius------------------------------------
  // goto posts
  await page.waitForNavigation()
  await page.locator(".system-logo").wait()
  const posts_link = await page.$eval('ul#usual-menu-list a[title=掲示板]', e => e.href)
  await page.goto(posts_link, {
    waitUntil: "domcontentloaded",
  })

  // foreach genres
  const genres_count = await page.$$eval("table#auto-table-4 a", e => e.filter(e => e.innerText.trim().startsWith("【")).length)

  for (let genre_index = 0; genre_index < genres_count; genre_index++) {
    // reload page so it is at the correct location even after error
    await page.goto("https://web.sirius.tuat.ac.jp")
    await sleep(2000);
    const posts_link = await page.$eval('ul#usual-menu-list a[title=掲示板]', e => e.href)
    await page.goto(posts_link, {
      waitUntil: "domcontentloaded",
    })

    const genre_link = await page.$$eval("table#auto-table-4 a", (e, i) => e.filter(e => e.innerText.trim().startsWith("【"))[i].href, genre_index)
    await page.goto(genre_link)

    const post_count = await page.$$eval("table#auto-table-2 a", e => e.length)
    for (let post_index = 0; post_index < post_count; post_index++) {
      try {
        const { link } = await page.$$eval("table#auto-table-2 a", (es, i) => ({ link: es[i].href, genre: es[i].innerText.trim() }), post_index)
        await page.goto(link)
      } catch (e) {
        console.error("could not jump to link", genre_index, post_index)
        await sleep(1000)
        continue
      }
      try {
        // get post information
        const title = await page.$eval("span.keiji-title", e => e.innerText.trim())
        const genre = await page.$eval("span.keiji-t-genre", e => e.innerText.trim().replaceAll(/[\[\]]/g, ""))
        const body = await page.$eval("div.keiji-naiyo", e => e.innerText.trim())
        const sender = await page.$$eval("table#auto-table-2 td", e => e[0].innerText.trim())
        const date = await page.$$eval("table#auto-table-2 td", e => e[1].innerText.trim())
        const same_content_count = db.query("select count(id) from posts where title = ?1 and date = ?2").get(title, date)

        if (same_content_count && typeof same_content_count == "object" && "count(id)" in same_content_count && same_content_count["count(id)"] == 0) {
          console.log(JSON.stringify({ title, genre, body, sender, date }))
          db.query("INSERT INTO posts (title,genre,body,sender,date) values (?1,?2,?3,?4,?5)").run(title, genre, body, sender, date)
          console.error("inserted new", title)
          if (process.env["SIRIUS_SCRAPE_SEND_DISCORD"] && discordwebhook) {
            await send_discord_message({ genre, title, body })
          }
        } else {
          console.error("already inserted", title)
        }
      } catch (e) {
        console.error("could not access elements", { post_index, genre_index }, e)
        await sleep(1000)
      }
      await page.goBack()
      await page.reload()
    }
  }

  // Close the browser
  await browser.close();
};

// Start the scraping
getPosts();
