// User service UUID: Change this to your generated service UUID
const USER_SERVICE_UUID = "9F5E638C-EDD8-4C26-9502-C0629F85EDE5"; // LED, Button
// User service characteristics
const LED_CHARACTERISTIC_UUID = "E9062E71-9E62-4BC6-B0D3-35CDCD9B027B";
const BTN_CHARACTERISTIC_UUID = "62FBD229-6EDD-4D1A-B554-5C4E1BB29169";

// PSDI Service UUID: Fixed value for Developer Trial
const PSDI_SERVICE_UUID = "E625601E-9E55-4597-A598-76018A0D293D"; // Device ID
const PSDI_CHARACTERISTIC_UUID = "26E2B12B-85F0-4F3F-9FDD-91D114270E6E";

// UI settings
let ledState = false; // true: LED on, false: LED off
let clickCount = 0;

// -------------- //
// On window load //
// -------------- //

window.onload = () => {
  initializeApp();
};

// ----------------- //
// Handler functions //
// ----------------- //

function handlerToggleLed() {
  ledState = !ledState;

  uiToggleLedButton(ledState);
  liffToggleDeviceLedState(ledState);
}

// ------------ //
// UI functions //
// ------------ //

function uiToggleLedButton(state) {
  const el = document.getElementById("btn-led-toggle");
  el.innerText = state ? "Switch LED OFF" : "Switch LED ON";

  if (state) {
    el.classList.add("led-on");
  } else {
    el.classList.remove("led-on");
  }
}

function uiCountPressButton() {
  clickCount++;

  const el = document.getElementById("click-count");
  el.innerText = clickCount;
}

function uiToggleStateButton(pressed) {
  const el = document.getElementById("btn-state");

  if (pressed) {
    el.classList.add("pressed");
    el.innerText = "Pressed";
  } else {
    el.classList.remove("pressed");
    el.innerText = "Released";
  }
}

function uiToggleDeviceConnected(connected) {
  const elStatus = document.getElementById("status");
  const elControls = document.getElementById("controls");

  elStatus.classList.remove("error");

  if (connected) {
    // Hide loading animation
    uiToggleLoadingAnimation(false);
    // Show status connected
    elStatus.classList.remove("inactive");
    elStatus.classList.add("success");
    elStatus.innerText = "Device connected";
    // Show controls
    elControls.classList.remove("x-hidden");
  } else {
    // Show loading animation
    uiToggleLoadingAnimation(true);
    // Show status disconnected
    elStatus.classList.remove("success");
    elStatus.classList.add("inactive");
    elStatus.innerText = "Device disconnected";
    // Hide controls
    elControls.classList.add("x-hidden");
  }
}

function uiToggleLoadingAnimation(isLoading) {
  const elLoading = document.getElementById("loading-animation");

  if (isLoading) {
    // Show loading animation
    elLoading.classList.remove("x-hidden");
  } else {
    // Hide loading animation
    elLoading.classList.add("x-hidden");
  }
}

function uiStatusError(message, showLoadingAnimation) {
  uiToggleLoadingAnimation(showLoadingAnimation);

  const elStatus = document.getElementById("status");
  const elControls = document.getElementById("controls");

  // Show status error
  elStatus.classList.remove("success");
  elStatus.classList.remove("inactive");
  elStatus.classList.add("error");
  elStatus.innerText = message;

  // Hide controls
  elControls.classList.add("x-hidden");
}

function makeErrorMsg(errorObj) {
  return "Error\n" + errorObj.code + "\n" + errorObj.message;
}

// -------------- //
// LIFF functions //
// -------------- //

function initializeApp() {
  liff.init(
    () => initializeLiff(),
    error => uiStatusError(makeErrorMsg(error), false)
  );
}

async function initializeLiff() {
  try {
    await liff.initPlugins(["bluetooth"]);
    liffCheckAvailablityAndDo(() => liffRequestDevice());
  } catch (error) {
    uiStatusError(makeErrorMsg(error), false);
  }
}

async function liffCheckAvailablityAndDo(callbackIfAvailable) {
  try {
    // Check Bluetooth availability
    const isAvailable = await liff.bluetooth.getAvailability();
    if (isAvailable) {
      uiToggleDeviceConnected(false);
      callbackIfAvailable();
    } else {
      uiStatusError("Bluetooth not available", true);
      setTimeout(() => liffCheckAvailablityAndDo(callbackIfAvailable), 10000);
    }
  } catch (error) {
    uiStatusError(makeErrorMsg(error), false);
  }
}

async function liffRequestDevice() {
  try {
    const device = await liff.bluetooth.requestDevice();
    window.gatt = device.gatt;
    window.device = device;
    // liffConnectToDevice(device);
  } catch (error) {
    uiStatusError(makeErrorMsg(error), false);
  }
}
async function liffConnectToDevice(device) {
  await device.gatt.connect();
}

async function liffGetServices(device) {
  try {
    document.getElementById("device-name").innerText = device.name;
    document.getElementById("device-id").innerText = device.id;

    // Show status connected
    uiToggleDeviceConnected(true);

    // Get service
    const service = await device.gatt.getPrimaryService(USER_SERVICE_UUID);
    const PSDIService = await device.gatt.getPrimaryService(PSDI_SERVICE_UUID);

    liffGetUserService(service);
    liffGetPSDIService(PSDIService);

    // Device disconnect callback
    const disconnectCallback = () => {
      // Show status disconnected
      uiToggleDeviceConnected(false);

      // Remove disconnect callback
      device.removeEventListener("gattserverdisconnected", disconnectCallback);

      // Reset LED state
      ledState = false;
      // Reset UI elements
      uiToggleLedButton(false);
      uiToggleStateButton(false);

      // Try to reconnect
      initializeLiff();
    };

    device.addEventListener("gattserverdisconnected", disconnectCallback);
  } catch (error) {
    uiStatusError(makeErrorMsg(error), false);
  }
}

async function liffGetUserService(service) {
  try {
    // Button pressed state
    const characteristic = await service.getCharacteristic(
      BTN_CHARACTERISTIC_UUID
    );
    liffGetButtonStateCharacteristic(characteristic);

    // Toggle LED
    const LEDCharacteristic = await service.getCharacteristic(
      LED_CHARACTERISTIC_UUID
    );

    window.ledCharacteristic = LEDCharacteristic;
    // Switch off by default
    liffToggleDeviceLedState(false);
  } catch (error) {
    uiStatusError(makeErrorMsg(error), false);
  }
}

async function liffGetPSDIService(service) {
  try {
    // Get PSDI value
    const characteristic = await service.getCharacteristic(
      PSDI_CHARACTERISTIC_UUID
    );

    const value = await characteristic.readValue();

    // Byte array to hex string
    const psdi = new Uint8Array(value.buffer).reduce(
      (output, byte) => output + ("0" + byte.toString(16)).slice(-2),
      ""
    );
    document.getElementById("device-psdi").innerText = psdi;
  } catch (error) {
    uiStatusError(makeErrorMsg(error), false);
  }
}

async function liffGetButtonStateCharacteristic(characteristic) {
  try {
    // Add notification hook for button state
    // (Get notified when button state changes)
    await characteristic.startNotifications();

    characteristic.addEventListener("characteristicvaluechanged", e => {
      const val = new Uint8Array(e.target.value.buffer)[0];
      if (val > 0) {
        // press
        uiToggleStateButton(true);
      } else {
        // release
        uiToggleStateButton(false);
        uiCountPressButton();
      }
    });
  } catch (error) {
    uiStatusError(makeErrorMsg(error), false);
  }
}

async function liffToggleDeviceLedState(state) {
  try {
    // on: 0x01
    // off: 0x00
    await window.ledCharacteristic.writeValue(
      state ? new Uint8Array([0x01]) : new Uint8Array([0x00])
    );
  } catch (error) {
    uiStatusError(makeErrorMsg(error), false);
  }
}

function reConnect() {
  window.characteristic.removeEventListener("characteristicvaluechanged");
  window.gatt.disconnect();
}

function connectDevice() {
  liffConnectToDevice(window.device);
}

function getServices() {
  liffGetServices(window.device);
}
