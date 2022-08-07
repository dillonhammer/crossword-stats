import axios from "axios";
import delay from "delay";
import dotenv from "dotenv";
dotenv.config();
import pMap from "p-map";
import fs from "fs";

// Start and end years are inclusive
const startYear = 2022;
const endYear = 2022;
const timestamp = new Date().getTime();
const puzzleIDsFile = `scraped-ids-${timestamp}`;
const puzzleDataFile = `scraped-puzzles-${timestamp}`;

type Month = {
  start: string;
  end: string;
};

// PuzzleIDs aren't strictly consecutive, so first scrape each month to get
// that month's puzzleIDs by date ascending
const months: Month[] = [];
for (let y = startYear; y <= endYear; y++) {
  for (let m = 1; m <= 12; m++) {
    const paddedMonth = m.toString().padStart(2, "0");
    months.push({
      start: `${y}-${paddedMonth}-01`,
      end: `${y}-${paddedMonth}-31`,
    });
  }
}

const monthMapper = async (month: Month) => {
  await delay(250);
  console.log("Scraping puzzleIDs for", month.start, "through", month.end);
  const monthInfo = (
    await axios.get(
      "https://nyt-games-prd.appspot.com/svc/crosswords/v3/undefined/puzzles.json",
      {
        params: {
          publish_type: "daily",
          sort_order: "asc",
          sort_by: "asc",
          date_start: month.start,
          date_end: month.end,
        },
      }
    )
  ).data;
  return monthInfo;
};

pMap(months, monthMapper, {
  concurrency: 1,
  stopOnError: false,
}).then((monthlyData) => {
  console.log(`Writing data to data/${puzzleIDsFile}.json`);

  const monthlyScrape = {
    startYear,
    endYear,
    scrapeDate: new Date(Date.now()).toDateString(),
    data: monthlyData,
  };

  fs.writeFileSync(`data/${puzzleIDsFile}.json`, JSON.stringify(monthlyScrape));

  console.log(`Finished writing data`);

  const puzzleIDs = [];

  for (let month of monthlyData) {
    if (month.results !== null) {
      for (let puzzle of month.results) {
        puzzleIDs.push(puzzle.puzzle_id);
      }
    }
  }

  const mapper = async (id: number) => {
    await delay(250);
    const puzzleInfo = (
      await axios.get(
        `https://nyt-games-prd.appspot.com/svc/crosswords/v6/game/${id}.json`,
        {
          headers: {
            "nyt-s": process.env.NYT_TOKEN,
          },
        }
      )
    ).data;
    console.log(`Scraped puzzle ${id}`);
    return puzzleInfo;
  };

  pMap(puzzleIDs, mapper, { concurrency: 1, stopOnError: false }).then(
    (puzzleData) => {
      console.log(`Writing data to data/${puzzleDataFile}.json`);

      fs.writeFileSync(
        `data/${puzzleDataFile}.json`,
        JSON.stringify(puzzleData)
      );

      console.log(`Finished writing data`);
    }
  );
});
