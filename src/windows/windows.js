const electron = require('electron')
const { app } = electron
const windowSnapper = require('./window-snapper')
const path = require('path')

let timerWindow, configWindow, fullscreenWindow
let snapThreshold, secondsUntilFullscreen, timerAlwaysOnTop

exports.createTimerWindow = () => {
  if (timerWindow) {
    return
  }

  let { width, height } = electron.screen.getPrimaryDisplay().workAreaSize
  timerWindow = new electron.BrowserWindow({
    x: width - 220,
    y: height - 90,
    width: 220,
    height: 90,
    resizable: false,
    alwaysOnTop: timerAlwaysOnTop,
    frame: false,
    icon: path.join(__dirname, '/../../src/windows/img/icon.png')
  })

  timerWindow.loadURL(`file://${__dirname}/timer/index.html`)
  timerWindow.on('closed', () => (timerWindow = null))

  timerWindow.on('move', () => {
    if (snapThreshold <= 0) {
      return
    }

    let getCenter = bounds => {
      return {
        x: bounds.x + (bounds.width / 2),
        y: bounds.y + (bounds.height / 2)
      }
    }

    let windowBounds = timerWindow.getBounds()
    let screenBounds = electron.screen.getDisplayNearestPoint(getCenter(windowBounds)).workArea

    let snapTo = windowSnapper(windowBounds, screenBounds, snapThreshold)
    if (snapTo.x !== windowBounds.x || snapTo.y !== windowBounds.y) {
      timerWindow.setPosition(snapTo.x, snapTo.y)
    }
  })
}

exports.showConfigWindow = () => {
  if (configWindow) {
    configWindow.show()
    return
  }
  exports.createConfigWindow()
}

exports.createConfigWindow = () => {
  if (configWindow) {
    return
  }

  configWindow = new electron.BrowserWindow({
    width: 420,
    height: 500,
    autoHideMenuBar: true
  })

  configWindow.loadURL(`file://${__dirname}/config/index.html`)
  configWindow.on('closed', () => (configWindow = null))
}

exports.createFullscreenWindow = () => {
  if (fullscreenWindow) {
    return
  }

  const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize
  fullscreenWindow = createAlwaysOnTopFullscreenInterruptingWindow({
    width,
    height,
    resizable: false,
    frame: false
  })

  fullscreenWindow.loadURL(`file://${__dirname}/fullscreen/index.html`)
  fullscreenWindow.on('closed', () => (fullscreenWindow = null))
}

exports.closeFullscreenWindow = () => {
  if (fullscreenWindow) {
    fullscreenWindow.close()
  }
}

exports.dispatchEvent = (event, data) => {
  if (event === 'configUpdated') {
    exports.setConfigState(data)
  }
  if (event === 'alert' && data === secondsUntilFullscreen) {
    exports.createFullscreenWindow()
  }
  if (event === 'stopAlerts') {
    exports.closeFullscreenWindow()
  }

  if (timerWindow) {
    timerWindow.webContents.send(event, data)
  }
  if (configWindow) {
    configWindow.webContents.send(event, data)
  }
  if (fullscreenWindow) {
    fullscreenWindow.webContents.send(event, data)
  }
}

exports.setConfigState = data => {
  var needToRecreateTimerWindow = timerAlwaysOnTop !== data.timerAlwaysOnTop

  snapThreshold = data.snapThreshold
  secondsUntilFullscreen = data.secondsUntilFullscreen
  timerAlwaysOnTop = data.timerAlwaysOnTop

  if (needToRecreateTimerWindow && timerWindow) {
    timerWindow.close()
    exports.createTimerWindow()
  }
}

function createAlwaysOnTopFullscreenInterruptingWindow(options) {
  return whileAppDockHidden(() => {
    const window = new electron.BrowserWindow(options)
    window.setAlwaysOnTop(true, 'screen-saver')
    return window
  })
}

function whileAppDockHidden(work) {
  if (app.dock) {
    // Mac OS: The window will be able to float above fullscreen windows too
    app.dock.hide()
  }
  const result = work()
  if (app.dock) {
    // Mac OS: Show in dock again, window has been created
    app.dock.show()
  }
  return result
}
