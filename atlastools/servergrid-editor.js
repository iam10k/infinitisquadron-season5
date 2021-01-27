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
};
// Options for all powerstone grids
const powerStoneGridOptions = {
  ServerCustomDatas1: 'FloatsamQualityMultiplier,NPCShipNumMult,NPCShipDifficultyMult,NPCShipDifficultyLerp',
  ServerCustomDatas2: '2.0,3.0,5.0,0.66',
};
// Should we delete control points
const deleteControlPoints = false;
// ================= END OPTIONS =================

const rawJson = fs.readFileSync(inputFilePath, 'utf-8');
const serverGridJson = JSON.parse(rawJson);
const gridIslandMap = new Map();

for (let s = 0; s < serverGridJson.servers.length; s++) {
  let serverInstance = serverGridJson.servers[s];
  const isPowerStone = powerStoneGrids.find(grid => grid[0] === serverInstance.gridX && grid[1] === serverInstance.gridY);
  if (isPowerStone) {
    serverInstance = Object.assign(serverInstance, powerStoneGridOptions);
  }

  const islands = [];

  for (let i = 0; i < serverInstance.islandInstances.length; i++) {
    const islandInstance = serverInstance.islandInstances[i];

    if (islandInstance.name !== 'ControlPoint') {
      serverInstance.islandInstances[i] = Object.assign(islandInstance, isPowerStone ? powerStoneGridIslandOptions : islandOptions);
    } else {
      if (deleteControlPoints) {
        serverInstance.islandInstances.splice(i, 1);
        i--;
        continue;
      }
    }

    islands.push(islandInstance.name);
  }
  serverGridJson.servers[s] = serverInstance;
  islands.sort((a, b) => { return a.localeCompare(b)});
  gridIslandMap.set(serverInstance.name.substring(0, 2), islands);
}
console.log(gridIslandMap);

fs.writeFileSync(outputFilePath, JSON.stringify(serverGridJson, null, 2), {encoding: 'utf-8'});
