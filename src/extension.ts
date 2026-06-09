import {
  initialize,
  MidiClip,
  ClipSlot,
  MidiTrack,
  DataModelObject,
  type ActivationContext,
  type Handle,
  type ArrangementSelection,
} from "@ableton-extensions/sdk";
import dialogHtml from "../ui/interface.html";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyJitter(
  clip: MidiClip<"1.0.0">,
  timingBeats: number,
  durationBeats: number,
  velAmount: number,
): void {
  clip.notes = clip.notes.map((note) => ({
    ...note,
    startTime: Math.max(0, note.startTime + (Math.random() - 0.5) * 2 * timingBeats),
    velocity: Math.max(
      1,
      Math.min(127, Math.round((note.velocity ?? 100) + (Math.random() - 0.5) * 2 * velAmount)),
    ),
    duration: Math.max(0.001, note.duration + (Math.random() - 0.5) * 2 * durationBeats),
  }));
}

function resolvePreselectedClips(
  arg: unknown,
  context: ReturnType<typeof initialize>,
): MidiClip<"1.0.0">[] {
  const clips: MidiClip<"1.0.0">[] = [];

  if (arg && typeof arg === "object" && "selected_clip_slots" in arg) {
    const sel = arg as { selected_clip_slots: Handle[] };
    for (const h of sel.selected_clip_slots) {
      const slot = context.getObjectFromHandle(h, ClipSlot);
      if (slot.clip instanceof MidiClip) {
        clips.push(slot.clip as MidiClip<"1.0.0">);
      }
    }
  } else if (arg && typeof arg === "object" && "time_selection_start" in arg) {
    const sel = arg as ArrangementSelection;
    for (const h of sel.selected_lanes) {
      const obj = context.getObjectFromHandle(h, DataModelObject);
      if (!(obj instanceof MidiTrack)) continue;
      for (const c of obj.arrangementClips) {
        if (
          c instanceof MidiClip &&
          c.startTime < sel.time_selection_end &&
          c.endTime > sel.time_selection_start
        ) {
          clips.push(c as MidiClip<"1.0.0">);
        }
      }
    }
  } else {
    const obj = context.getObjectFromHandle(arg as Handle, DataModelObject<"1.0.0">);
    if (obj instanceof MidiClip) {
      clips.push(obj as MidiClip<"1.0.0">);
    } else if (obj instanceof ClipSlot && obj.clip instanceof MidiClip) {
      clips.push(obj.clip as MidiClip<"1.0.0">);
    }
  }

  return clips;
}

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");

  context.commands.registerCommand("human-touch.jitter", async (arg: unknown) => {
    const preselected = resolvePreselectedClips(arg, context);
    const preselectedSet = new Set(preselected);

    const allClipItems: Array<{
      clip: MidiClip<"1.0.0">;
      trackName: string;
    }> = [];

    for (const track of context.application.song.tracks) {
      if (!(track instanceof MidiTrack)) continue;
      for (const slot of track.clipSlots) {
        if (slot.clip instanceof MidiClip) {
          allClipItems.push({ clip: slot.clip as MidiClip<"1.0.0">, trackName: track.name });
        }
      }
      for (const c of track.arrangementClips) {
        if (c instanceof MidiClip) {
          allClipItems.push({ clip: c as MidiClip<"1.0.0">, trackName: track.name });
        }
      }
    }

    if (allClipItems.length === 0) return;

    const clipRows = allClipItems
      .map((item, i) => {
        const checked = preselectedSet.has(item.clip) ? "checked" : "";
        const label = `${escapeHtml(item.trackName)} / ${escapeHtml(item.clip.name || "Untitled")}`;
        return `<label class="clip-item" data-index="${i}"><input type="checkbox" class="clip-check" ${checked}><span class="clip-label">${label}</span></label>`;
      })
      .join("");

    const html = dialogHtml.replace("__CLIP_LIST__", clipRows);
    const url = `data:text/html,${encodeURIComponent(html)}`;
    const result = await context.ui.showModalDialog(url, 480, 460);
    if (!result) return;
    const settings = JSON.parse(result);
    if (settings.cancelled) return;

    let targets: MidiClip<"1.0.0">[];
    if (settings.selectedIndices === "all") {
      targets = allClipItems.map((item) => item.clip);
    } else if (
      Array.isArray(settings.selectedIndices) &&
      settings.selectedIndices.length > 0
    ) {
      targets = settings.selectedIndices.map((i: number) => allClipItems[i].clip);
    } else {
      return;
    }

    const timingBeats = settings.timingJitter / 960;
    const durationBeats = settings.durationJitter / 960;
    const velAmount = settings.velocityJitter;

    context.withinTransaction(() => {
      for (const clip of targets) {
        applyJitter(clip, timingBeats, durationBeats, velAmount);
      }
    });
  });

  (
    [
      "MidiClip",
      "ClipSlot",
      "MidiTrack.ArrangementSelection",
    ] as const
  ).forEach((scope) =>
    context.ui.registerContextMenuAction(
      scope,
      "Human Touch Jitter\u2026",
      "human-touch.jitter",
    ),
  );
}
