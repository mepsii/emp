# Electron Media Player

An incredibly basic, vibecoded, media player in electron, its sole purpose is to make vintage M$ WMP-Legacy skins run in a modern cross platform enviroment. 

## Features
* essentially complete support for goo skin. most others have not been tested yet
* compared directly against wmp9 in a xp vm, to try and get it as accurate feeling as possible
* some classic styled visualizers
* nostalgia bait for desktop screenshots

----

## Prerequisites
* Node.js (v18+)
* npm

## Installation
1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd emp
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage
Start the player:
```bash
npm start
```

## Skins
* Place skins in the `skins/` directory.
* Supported formats: `.wmz` / ZIP archives containing skin configuration files.

## License
This project is licensed under the GNU General Public License v3.0 or later (GPL-3.0-or-later). See the LICENSE file for details.
