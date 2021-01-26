const fs = require('fs');

// ================= OPTIONS =================
const inputFilePath = '../ServerGrid.json';           // Input file
const outputFilePath = '../ServerGrid.Updated.json';  // Output file

// Options for all islands
const islandOptions = {
  finalNPCLevelMultiplier: 2.0
};
// A list of power stone grids
const powerStoneGrids = [[0, 1], [0, 6], [1, 4], [2, 0], [3, 2], [3, 4], [3, 6], [5, 0], [6, 6]];
// Options for all islands in a power stone grid
const powerStoneGridIslandOptions = {
  finalNPCLevelMultiplier: 2.0,
  instanceTreasureQualityMultiplier: 2.0
}
// Should we delete control points
const deleteControlPoints = false;
// ================= END OPTIONS =================

const rawJson = fs.readFileSync(inputFilePath, 'utf-8');
const serverGridJson = JSON.parse(rawJson);
const gridIslandMap = new Map();

for (const server of serverGridJson.servers) {
  const islands = [];

  for (let i = 0; i < server.islandInstances.length; i++) {
    const islandInstance = server.islandInstances[i];

    if (islandInstance.name !== 'ControlPoint') {
      if (powerStoneGrids.find(grid => grid[0] === server.gridX && grid[1] === server.gridY)) {
        server.islandInstances[i] = Object.assign(islandInstance, powerStoneGridIslandOptions);
      } else {
        server.islandInstances[i] = Object.assign(islandInstance, islandOptions);
      }
    } else {
      if (deleteControlPoints) {
        server.islandInstances.splice(i, 1);
        i--;
        continue;
      }
    }

    islands.push(islandInstance.name);
  }
  islands.sort((a, b) => { return a.localeCompare(b)});
  gridIslandMap.set(server.name.substring(0, 2), islands);
}

fs.writeFileSync(outputFilePath, JSON.stringify(serverGridJson, null, 2), {encoding: 'utf-8'});
