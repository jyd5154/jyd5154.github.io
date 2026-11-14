// ============================================================
//  LOADING PAGE  -  edit this file to change what the start screen says.
//  Save it and refresh the page to see the change.
// ============================================================
export const BOOT = {
  // Each line appears one after another, like an old computer starting up.
  // Use '' (two quote marks with nothing between) for a blank line.
  lines: [
    'DAWG BIOS (C) 2026 DEEP WATER RESEARCH LTD',
    'ZD-PROTO 13 2026-2026 Special UC131S',
    '',
    'Checking RAM : 64000 OK',
    'Detecting CRT monitor ........ found',
    'Loading desk .................. 25%',
    'Loading lamp .................. 50%',
    'Loading bookshelf ............. 75%',
    'Loading publications ......... 100%',
    '',
    "All content loaded. Launching 'Zero Deng Showcase' v0.1",
    "Welcome to the real world",
  ],

  // The text on the button that appears when the lines are finished.
  startLabel: 'ENTER',

  // How long to wait between lines, in milliseconds (1000 = one second).
  lineDelayMs: 160,

  // Colours (any CSS colour, such as '#9fe8a0', 'orange' or 'white').
  textColor: '#9fe8a0',
  buttonColor: '#9fe8a0',
};
