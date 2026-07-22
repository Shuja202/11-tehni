// Audio elements
let musicElement = new Audio();
let sfxElement = new Audio();
let previousMusicVolume = 70;
let previousSFXVolume = 80;

// Get control elements
const musicVolume = document.getElementById("musicVolume");
const sfxVolume = document.getElementById("sfxVolume");
const musicValue = document.getElementById("musicValue");
const sfxValue = document.getElementById("sfxValue");
const status = document.getElementById("status");

// Music volume control
musicVolume.addEventListener("input", function () {
  const volume = this.value;
  musicValue.textContent = volume;
  musicElement.volume = volume / 100;
  previousMusicVolume = volume;
  updateStatus(`Music volume: ${volume}%`);
});

// SFX volume control
sfxVolume.addEventListener("input", function () {
  const volume = this.value;
  sfxValue.textContent = volume;
  sfxElement.volume = volume / 100;
  previousSFXVolume = volume;
  updateStatus(`Interaction sound volume: ${volume}%`);
});

console.log("Music and SFX volume controls initialized.");

// Test music playback
function playMusicTest() {
  musicElement.volume = musicVolume.value / 100;
  musicElement.play().catch((err) => {
    updateStatus("⚠️ No audio source set");
  });
  updateStatus("🎵 Playing music preview...");
}

// Test SFX playback
function playSFXTest() {
  sfxElement.volume = sfxVolume.value / 100;
  sfxElement.play().catch((err) => {
    updateStatus("⚠️ No audio source set");
  });
  updateStatus("🔘 Playing interaction sound preview...");
}

// Mute all
function muteAll() {
  musicVolume.value = 0;
  sfxVolume.value = 0;
  musicValue.textContent = "0";
  sfxValue.textContent = "0";
  musicElement.volume = 0;
  sfxElement.volume = 0;
  updateStatus("🔇 All sounds muted");
}

// Unmute all
function unmuteAll() {
  musicVolume.value = previousMusicVolume;
  sfxVolume.value = previousSFXVolume;
  musicValue.textContent = previousMusicVolume;
  sfxValue.textContent = previousSFXVolume;
  musicElement.volume = previousMusicVolume / 100;
  sfxElement.volume = previousSFXVolume / 100;
  updateStatus("🔊 Sounds restored");
}

// Update status display
function updateStatus(message) {
  status.textContent = message;
}

// Initialize volumes
musicElement.volume = 0.7;
sfxElement.volume = 0.8;
