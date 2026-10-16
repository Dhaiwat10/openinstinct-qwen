import { defineDynamic, defineInstructions } from "eve/instructions";

const currentTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "UTC",
});

// Models only know their training cutoff, so state the date on every turn.
// A user-role note lands right before the turn's message: a system-role date
// sits ahead of the whole conversation, where long iMessage threads drown it
// out and the model falls back to its training-era date.
export default defineDynamic({
  events: {
    "turn.started": () => {
      const now = new Date();
      return defineInstructions({
        content: [
          `The current date and time is ${currentTimeFormat.format(now)} UTC (${now.toISOString()}).`,
          "Use it, not your training data or earlier messages, to decide what today is and what is upcoming, past, or recent. Convert it to the user's timezone when you know it, and derive calendar and schedule time ranges from it.",
          "Your own knowledge stops at your training cutoff. For anything that changes over time, such as schedules, fixtures, prices, news, or opening hours, check with web_search before answering instead of relying on memory.",
        ].join(" "),
        role: "user",
      });
    },
  },
});
