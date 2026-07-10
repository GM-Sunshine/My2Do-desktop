import { clipboard, Menu, MenuItemConstructorOptions, shell, WebContents } from 'electron';

/**
 * A native right-click menu: spelling fixes and edit actions in fields, copy for
 * selected text, open/copy for links, and window navigation everywhere. Built
 * fresh per click from the hit-test params so items match what's under the cursor.
 */
export function attachContextMenu(contents: WebContents): void {
  contents.on('context-menu', (_event, params) => {
    const items: MenuItemConstructorOptions[] = [];

    // Spelling suggestions come first when right-clicking a misspelled word.
    if (params.isEditable && params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        items.push({ label: suggestion, click: () => contents.replaceMisspelling(suggestion) });
      }
      if (params.dictionarySuggestions.length === 0) {
        items.push({ label: 'No suggestions', enabled: false });
      }
      items.push({ type: 'separator' });
    }

    // Links.
    if (params.linkURL) {
      items.push(
        { label: 'Open link in browser', click: () => void shell.openExternal(params.linkURL) },
        { label: 'Copy link', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' },
      );
    }

    // Editing.
    if (params.isEditable) {
      items.push(
        { role: 'cut', enabled: params.editFlags.canCut },
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'paste', enabled: params.editFlags.canPaste },
        { role: 'selectAll' },
        { type: 'separator' },
      );
    } else if (params.selectionText) {
      items.push({ role: 'copy' }, { type: 'separator' });
    }

    // Navigation — always available.
    items.push(
      { label: 'Back', enabled: contents.navigationHistory.canGoBack(), click: () => contents.navigationHistory.goBack() },
      { label: 'Forward', enabled: contents.navigationHistory.canGoForward(), click: () => contents.navigationHistory.goForward() },
      { label: 'Reload', click: () => contents.reload() },
    );

    Menu.buildFromTemplate(items).popup();
  });
}
