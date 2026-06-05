import {
  initialize,
  MidiClip,
  ClipSlot,
  DataModelObject,
  type ActivationContext,
  type Handle,
} from "@ableton-extensions/sdk";
import dialogHtml from "../ui/interface.html";

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");

  context.commands.registerCommand("human-touch.jitter", async (arg: unknown) => {
    const obj = context.getObjectFromHandle(arg as Handle, DataModelObject<"1.0.0">);

    let clip: MidiClip<"1.0.0"> | null = null;
    if (obj instanceof MidiClip) {
      clip = obj as MidiClip<"1.0.0">;
    } else if (obj instanceof ClipSlot && obj.clip instanceof MidiClip) {
      clip = obj.clip as MidiClip<"1.0.0">;
    }

    if (!clip) {
      console.warn("human-touch: right-click a MIDI clip or a ClipSlot containing one");
      return;
    }

    if (clip.notes.length === 0) return;

    const url = `data:text/html,${encodeURIComponent(dialogHtml)}`;
    const result = await context.ui.showModalDialog(url, 400, 330);
    if (!result) return;
    const settings = JSON.parse(result);
    if (settings.cancelled) return;

    const timingBeats = settings.timingJitter / 960;
    const durationBeats = settings.durationJitter / 960;
    const velAmount = settings.velocityJitter;

    context.withinTransaction(() => {
      clip!.notes = clip!.notes.map((note) => ({
        ...note,
        startTime: Math.max(0, note.startTime + (Math.random() - 0.5) * 2 * timingBeats),
        velocity: Math.max(
          1,
          Math.min(127, Math.round((note.velocity ?? 100) + (Math.random() - 0.5) * 2 * velAmount)),
        ),
        duration: Math.max(0.001, note.duration + (Math.random() - 0.5) * 2 * durationBeats),
      }));
    });
  });

  (["MidiClip", "ClipSlot"] as const).forEach((scope) =>
    context.ui.registerContextMenuAction(scope, "Human Touch Jitter\u2026", "human-touch.jitter"),
  );
}
