import { defineDynamic, defineInstructions } from "eve/instructions";

const currentTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "UTC",
});

// Models only know their training cutoff, so state the date on every turn.
// This stays the last instruction file so earlier prompt text remains cacheable.
export default defineDynamic({
  events: {
    "turn.started": () =>
      defineInstructions({
        content: [
          `The current date and time is ${currentTimeFormat.format(new Date())} UTC.`,
          "Use it to decide what is upcoming, past, or recent, and convert it to the user's timezone when you know it.",
          "Your own knowledge stops at your training cutoff. For anything that changes over time, such as schedules, fixtures, prices, news, or opening hours, check with web_search before answering instead of relying on memory.",
        ].join(" "),
      }),
  },
});
