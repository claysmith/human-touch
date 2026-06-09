import {
  initialize,
  MidiClip,
  ClipSlot,
  MidiTrack,
  DataModelObject,
  type ActivationContext,
  type Handle,
} from "@ableton-extensions/sdk";
import dialogHtml from "../ui/interface.html";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function applyJitter(clip: MidiClip<"1.0.0">, timingBeats: number, durationBeats: number, velAmount: number): void {
  clip.notes = clip.notes.map((note) => ({
    ...note,
    startTime: Math.max(0, note.startTime + (Math.random() - 0.5) * 2 * timingBeats),
    velocity: Math.max(1, Math.min(127, Math.round((note.velocity ?? 100) + (Math.random() - 0.5) * 2 * velAmount))),
    duration: Math.max(0.001, note.duration + (Math.random() - 0.5) * 2 * durationBeats),
  }));
}

function resolvePreselectedClip(arg: unknown, context: ReturnType<typeof initialize>): MidiClip<"1.0.0"> | null {
  const obj = context.getObjectFromHandle(arg as Handle, DataModelObject<"1.0.0">);
  if (obj instanceof MidiClip) return obj as MidiClip<"1.0.0">;
  if (obj instanceof ClipSlot && obj.clip instanceof MidiClip) return obj.clip as MidiClip<"1.0.0">;
  return null;
}

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");

  context.commands.registerCommand("human-touch.jitter", async (arg: unknown) => {
    const preselectedClip = resolvePreselectedClip(arg, context);
    const preselectedClips = preselectedClip ? [preselectedClip] : [];
    const preselectedSet = new Set(preselectedClips);

    const seen = new Set<bigint>();
    const allClipItems: Array<{
      clip: MidiClip<"1.0.0">;
      trackName: string;
      label: string;
      origin: "session" | "arrangement";
    }> = [];

    for (const track of context.application.song.tracks) {
      if (!(track instanceof MidiTrack)) continue;
      track.clipSlots.forEach((slot, si) => {
        if (slot.clip instanceof MidiClip && !seen.has(slot.clip.handle.id)) {
          seen.add(slot.clip.handle.id);
          const name = slot.clip.name || `Scene ${si + 1}`;
          allClipItems.push({ clip: slot.clip as MidiClip<"1.0.0">, trackName: track.name, label: name, origin: "session" });
        }
      });
      for (const c of track.arrangementClips) {
        if (c instanceof MidiClip && !seen.has(c.handle.id)) {
          seen.add(c.handle.id);
          const name = c.name || `Bar ${Math.floor(c.startTime / 4) + 1}`;
          allClipItems.push({ clip: c as MidiClip<"1.0.0">, trackName: track.name, label: name, origin: "arrangement" });
        }
      }
    }

    if (allClipItems.length === 0) return;

    const clipRows = allClipItems
      .map((item, i) => {
        const checked = preselectedSet.has(item.clip) ? "checked" : "";
        const originLabel = item.origin === "session" ? "S" : "A";
        return `<label class="clip-item" data-index="${i}"><input type="checkbox" class="clip-check" ${checked}><span class="clip-label">${escapeHtml(item.trackName)} / ${escapeHtml(item.label)}</span><span class="clip-badge">${originLabel}</span></label>`;
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

  (["MidiClip", "ClipSlot"] as const).forEach((scope) =>
    context.ui.registerContextMenuAction(scope, "Human Touch Jitter\u2026", "human-touch.jitter"),
  );
}
