/**
 * Shared sizing for the document frame shown inside the exam.
 *
 * Two renderers draw a framed document and therefore share these values:
 * ONLYOFFICE (`OnlyOfficeEditor`) and the Microsoft Office Online iframe
 * (`OfficeViewer`). Keeping them on one number stops the layout jumping when the
 * viewer falls back from one to the other.
 *
 * These values used to be repeated in each component and had already drifted
 * apart (520 / 560 / 600 px). They live here now so there is one number to
 * change.
 *
 * The built-in editor (`WordWorkspace`) needs nothing from here: its root is
 * already `flex-1`, so it simply fills whatever height the card ends up with.
 *
 * ## How the frame fills the card exactly
 *
 * The card is given a DEFINITE height (`h-[calc(100dvh-180px)]`, i.e. one
 * screenful minus the site header), and the frame is then `h-full` of the space
 * left over after the title bar.
 *
 * A `min-height` alone could not do this: it sets a floor, so anything shorter
 * than the card would still not reach the bottom. A definite height on the card
 * is what lets the frame's percentage resolve, and it also means the editor
 * grows and shrinks with the window instead of stopping at a fixed pixel value.
 *
 * `min-h` is kept on the card as a floor for short windows. It is NOT a
 * fallback for the frame: a percentage height does not resolve against a parent
 * whose height is `auto`, so if `dvh` were ever unsupported the card would be
 * floored at 760px while the frame collapsed. The frame therefore carries its
 * own plain-pixel `min-h` so it still has a usable height in that case.
 */

/**
 * The card that surrounds the frame, including its title bar.
 *
 * `h-[calc(100dvh-180px)]` is one screenful of editor; 180px covers the site
 * header plus the page's own spacing, so the editor needs no scrolling of its
 * own to be fully usable.
 */
export const EDITOR_PANEL_CLASS =
  "flex h-[calc(100dvh-180px)] min-h-[760px] flex-col overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-border";

/**
 * The document frame itself (the ONLYOFFICE placeholder / the viewer iframe).
 *
 * `h-full` is what makes it fill the card exactly - the card's height is
 * definite, so the percentage resolves. The `min-h` sits well below the card's
 * own floor (760px minus the ~45px title bar = ~715px), so it never fights the
 * fill; it only matters in the degraded case described above.
 */
export const EDITOR_FRAME_CLASS = "h-full w-full min-h-[600px]";

