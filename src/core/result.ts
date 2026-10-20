/** Outcome of a player action, with a message suitable for the message log. */
export interface ActionResult {
  ok: boolean;
  message: string;
}

export const success = (message: string): ActionResult => ({ ok: true, message });
export const failure = (message: string): ActionResult => ({ ok: false, message });
