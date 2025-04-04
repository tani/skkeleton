import { config } from "../config.ts";
import { Context } from "../context.ts";
import { currentLibrary } from "../jisyo.ts";
import { currentKanaTable } from "../kana.ts";
import { initializeState } from "../state.ts";
import { kakuteiFeed } from "./input.ts";
import { modeChange } from "./mode.ts";

export async function kakutei(context: Context) {
  const state = context.state;
  switch (state.type) {
    case "henkan": {
      const candidate = state.candidates[state.candidateIndex];
      const candidateStrip = candidate?.replace(/;.*/, "");
      if (candidate) {
        const lib = await currentLibrary.get();
        await lib.registerCandidate(
          state.mode,
          state.word,
          candidate,
        );
      }
      const okuriStr = state.converter
        ? state.converter(state.okuriFeed)
        : state.okuriFeed;
      const ret = (candidateStrip ?? "error") + okuriStr;
      context.kakuteiWithUndoPoint(ret);
      break;
    }
    case "input": {
      kakuteiFeed(context);
      let result = state.henkanFeed + state.okuriFeed + state.feed;
      if (state.converter) {
        result = state.converter(result);
      }
      context.kakutei(result);
      if (currentKanaTable.get() === "zen") {
        currentKanaTable.set(config.kanaTable);
        state.converter = void 0;
      }
      break;
    }
    default:
      console.warn(
        `initializing unknown phase state: ${JSON.stringify(state)}`,
      );
  }
  if (context.mode === "abbrev") {
    await modeChange(context, "hira");
    initializeState(state, []);
    return;
  }
  initializeState(state, ["converter", "table"]);
}

export async function newline(context: Context) {
  const insertNewline = !(config.eggLikeNewline &&
    (context.state.type === "henkan" ||
      (context.state.type === "input" && context.state.mode !== "direct")));
  await kakutei(context);
  if (insertNewline) {
    context.kakutei("\n");
  }
}

export function cancel(context: Context) {
  const state = context.state;
  if (
    state.type === "input" &&
    state.mode === "direct" &&
    context.vimMode === "c"
  ) {
    context.kakutei("\x03");
  }
  if (config.immediatelyCancel) {
    initializeState(context.state);
    return;
  }
  switch (state.type) {
    case "input":
      initializeState(state);
      break;
    case "henkan":
      context.state.type = "input";
      break;
  }
}
