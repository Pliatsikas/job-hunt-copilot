/**
 * The focus ring shared by the native `<select>` elements, matching the one
 * Input and Textarea carry. Without it a select keeps the browser default,
 * which differs per platform and leaves one control in every form looking
 * unfocusable next to its neighbours.
 *
 * These stay native selects on purpose: the options are short, fixed lists,
 * and a native control is keyboard- and screen-reader-correct for free, on a
 * phone as well as a desktop.
 */
export const SELECT_FOCUS =
  " outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
