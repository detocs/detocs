import { getVersion, getHomepage } from '@util/meta';

export default async function start({ port }: { port: number }): Promise<void> {
  const { app, shell, BrowserWindow, Menu, MenuItem } = await import('electron');

  function setLinkHandler(win: Electron.BrowserWindow, shell: Electron.Shell): void {
    const handleRedirect = (e: Electron.Event, url: string): void => {
      if (url != win.webContents.getURL()) {
        e.preventDefault();
        shell.openExternal(url);
      }
    };
    win.webContents.on('will-navigate', handleRedirect);
    win.webContents.on('new-window', handleRedirect);
  }

  function setMenu(app: Electron.App): void {
    const newMenu = new Menu();
    Menu.getApplicationMenu()?.items
      .filter(item => item.role != 'help')
      .forEach(newMenu.append.bind(newMenu));
    const helpSubmenu = new Menu();
    helpSubmenu.append(new MenuItem({
      label: `${app.getName()} ${getVersion()}`,
      type: 'normal',
      click: () => shell.openExternal(getHomepage()),
    }));
    newMenu.append(new MenuItem({
      type: 'submenu',
      role: 'help',
      label: 'Help',
      submenu: helpSubmenu,
    }));
    Menu.setApplicationMenu(newMenu);
  }

  const win = new BrowserWindow({
    autoHideMenuBar: true,
  });
  setLinkHandler(win, shell);
  setMenu(app);

  return app.whenReady().then(() => {
    return win.loadURL(`http://localhost:${port}`);
  });
}
