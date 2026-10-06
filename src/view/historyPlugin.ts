import { history, redo, undo } from '@milkdown/prose/history';
import { keymap } from '@milkdown/prose/keymap';
import { $prose } from '@milkdown/utils';
import { createHistoryKeyBindings } from './history';

const historyKeyBindings = createHistoryKeyBindings(undo, redo);

export const undoRedoHistoryPlugin = $prose(() => history());

export const undoRedoKeymapPlugin = $prose(() => keymap(historyKeyBindings));
