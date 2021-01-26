if (!window) {
  function require() {}
  const
    React = require("react"),
    ReactDOM = require("react-dom"),
    L = require("leaflet");
}

class WorldMap extends React.Component {
  constructor(props) {
    super(props)
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  componentDidMount() {
    const layerOpts = {
      maxZoom: 9,
      maxNativeZoom: 6,
      minZoom: 1,
      bounds: L.latLngBounds([0, 0], [-256, 256]),
      noWrap: true,
    };

    const baseLayer = L.tileLayer("tiles/{z}/{x}/{y}.png", layerOpts);
    const cordsRegex = /(-?\d?\d(?:\.\d\d?)?)[^\d-]*(-?\d?\d(?:\.\d\d?)?)/;
    const tpRegex = /.*(?:[Tt][Pp] )([A-z]+)(\d+) (-?\d+) (-?\d+).*/;

    const map = this.worldMap = L.map("worldmap", {
      crs: L.CRS.Simple,
      layers: [baseLayer],
      zoomControl: false,
      attributionControl: false,
    })

    // Remove features after 5 minutes
    setInterval(function () {
      map.eachLayer(function (layer) {
        if (layer.feature && new Date - layer.feature.properties.created > 15 * 60 * 1000) {
          map.removeLayer(layer)
        }
      });
    }, 1000);

    map.IslandTerritories = L.layerGroup(layerOpts);
    map.IslandResources = L.layerGroup(layerOpts);
    map.Discoveries = L.layerGroup(layerOpts);
    map.Names = L.layerGroup(layerOpts);
    map.NamesBlobs = L.layerGroup(layerOpts);
    map.Bosses = L.layerGroup(layerOpts);
    map.ControlPoints = L.layerGroup(layerOpts);
    map.Ships = L.layerGroup(layerOpts);
    map.GhostShips = L.layerGroup(layerOpts);
    map.Stones = L.layerGroup(layerOpts);
    map.Treasure = L.layerGroup(layerOpts);
    map.Pins = L.layerGroup(layerOpts);
    map.Mouse = L.layerGroup(layerOpts);

    // Always Layers
    map.Pins.addTo(map);
    map.Mouse.addTo(map);

    const locationIcon = L.icon({
      iconUrl: 'icons/location.svg',
      iconSize: [36, 60],
      iconAnchor: [18, 30],
    });

    const urlParams = new URLSearchParams(window.location.search);

    const SearchBox = L.Control.extend({
      onAdd: function () {
        const element = document.createElement("input");
        element.id = "searchBox";
        element.placeholder = "search for resources or cords(x,y)";

        element.onchange = function (ev) {
          const search = document.getElementById("searchBox").value.toLowerCase();
          urlParams.set('s', search);
          window.history.replaceState({}, document.title, `${location.pathname}?${urlParams}`);

          map.Pins.clearLayers();

          let long = null;
          let lat = null;
          if (tpRegex.test(search.trim())) {
            const matches = search.trim().match(tpRegex);
            [long, lat] = tpCmdToXY(matches[1], Number(matches[2]), Number(matches[3]), Number(matches[4]));
          } else if (cordsRegex.test(search.trim())) {
            const matches = search.trim().match(cordsRegex);
            long = Number(matches[1]);
            lat = Number(matches[2]);
          }

          if (long && lat && !isNaN(long) && !isNaN(lat)) {
            const cordPin = new L.Marker(GPStoLeaflet(long, lat), {
              icon: locationIcon,
            });

            cordPin.bindPopup(`Pin: ${long.toFixed(2)} / ${lat.toFixed(2)}`, {
              showOnMouseOver: true,
              autoPan: true,
              keepInView: true,
            });

            map.Pins.addLayer(cordPin);
            map.flyTo(GPStoLeaflet(long, lat), 2.5);
            return;
          }

          map.IslandResources.eachLayer(function (layer) {
            if (search !== "" &&
                (
                    layer.animals.find(function (element) {
                      return element.toLowerCase().includes(search);
                    }) ||
                    layer.resources.find(function (element) {
                      return element.toLowerCase().includes(search);
                    }))
            ) {
              layer.setStyle({
                radius: 1.5,
                color: "#f00",
                opacity: .8,
                fillOpacity: .6
              });
            } else {
              layer.setStyle({
                radius: 1.5,
                color: "#f00",
                opacity: 0,
                fillOpacity: 0.1
              });
            }
            if (search !== "" && search.includes('_') && layer.name.toLowerCase().includes(search)) {
              layer.setStyle({
                radius: 1.5,
                color: "#00f",
                opacity: 1,
                fillOpacity: 1
              });
            }
          });

        };
        return element;
      }
    });
    (new SearchBox).addTo(map);

    // Add zoom control
    L.control.zoom({
      position: 'topright'
    }).addTo(map);

    // Add Layer Control
    L.control.layers({}, {
      Islands: L.tileLayer("islands/{z}/{x}/{y}.png", layerOpts).addTo(map),
      Grid: L.tileLayer("grid/{z}/{x}/{y}.png", layerOpts).addTo(map),
      Names: L.tileLayer("names/{z}/{x}/{y}.png", layerOpts),
      Resources: map.IslandResources.addTo(map),
      Discoveries: map.Discoveries,
      'Power Stones': map.Stones,
      Bosses: map.Bosses,
      Treasure: map.Treasure,
      'Control Points': map.ControlPoints,
      Ships: map.Ships,
      'Ghost Ships': map.GhostShips.addTo(map),
    }, {
      position: 'topright',
      collapsed: false
    }).addTo(map);

    var stickyLayers = {};
    map.on('overlayadd', function (e) {
      stickyLayers[e.name] = true;
    });

    map.on('overlayremove', function (e) {
      stickyLayers[e.name] = false;
    });

    map.on('zoomend', function () {
      if (map.getZoom() < 5) {
        if (!stickyLayers["Bosses"]) map.removeLayer(map.Bosses);
        if (!stickyLayers["Stones"]) map.removeLayer(map.Stones);
      } else {
        if (!stickyLayers["Bosses"]) {
          map.addLayer(map.Bosses);
          stickyLayers["Bosses"] = false;
        }

        if (!stickyLayers["Stones"]) {
          map.addLayer(map.Stones);
          stickyLayers["Stones"] = false;
         }
      }
    });

    map.setView([-128, 128], 2);

    const input = document.getElementById("searchBox");

    function refreshFromQuery() {
      if (urlParams.has('s')) {
        input.setAttribute('value', urlParams.get('s'));
        input.onchange();
      }
    }
    refreshFromQuery();

    const CPIcon = L.icon({
      iconUrl: 'icons/lighthouse.svg',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const hydraIcon = L.icon({
      iconUrl: 'icons/Hydra.svg',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const yetiIcon = L.icon({
      iconUrl: 'icons/Yeti.svg',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const drakeIcon = L.icon({
      iconUrl: 'icons/Drake.svg',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const meanWhaleIcon = L.icon({
      iconUrl: 'icons/MeanWhale.svg',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const gentleWhaleIcon = L.icon({
      iconUrl: 'icons/GentleWhale.svg',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const giantSquidIcon = L.icon({
      iconUrl: 'icons/GiantSquid.svg',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const stoneIcon = L.icon({
      iconUrl: 'icons/Stone.svg',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    fetch('json/bosses.json', {
        dataType: 'json'
      })
      .then(res => res.json())
      .then(function (bosses) {
        bosses.forEach(d => {
          let pin;
          if (d.name === "Drake") {
            pin = new L.Marker(GPStoLeaflet(d.long, d.lat), {
              icon: drakeIcon,
            });
          } else if (d.name === "Hydra") {
            pin = new L.Marker(GPStoLeaflet(d.long, d.lat), {
              icon: hydraIcon,
            });
          } else if (d.name === "Yeti") {
            pin = new L.Marker(GPStoLeaflet(d.long, d.lat), {
              icon: yetiIcon,
            });
          } else if (d.name === "GiantSquid") {
            pin = new L.Marker(GPStoLeaflet(d.long, d.lat), {
              icon: giantSquidIcon,
            });
          } else if (d.name === "GentleWhale") {
            pin = new L.Marker(GPStoLeaflet(d.long, d.lat), {
              icon: gentleWhaleIcon,
            });
          } else if (d.name === "MeanWhale") {
            pin = new L.Marker(GPStoLeaflet(d.long, d.lat), {
              icon: meanWhaleIcon,
            });
          }

          if (!pin) {
            return;
          }

          pin.bindPopup(`${d.name}: ${d.long.toFixed(2)} / ${d.lat.toFixed(2)}`, {
            showOnMouseOver: true,
            autoPan: true,
            keepInView: true,
          });

          map.Bosses.addLayer(pin);
        })
      })
      .catch(error => {
        console.log(error)
      });

    fetch('json/stones.json', {
        dataType: 'json'
      })
      .then(res => res.json())
      .then(function (stones) {
        stones.forEach(d => {
          var pin = new L.Marker(GPStoLeaflet(d.long, d.lat), {
            icon: stoneIcon,
          });
          pin.bindPopup(`${d.name}: ${d.long.toFixed(2)} / ${d.lat.toFixed(2)}`, {
            showOnMouseOver: true,
            autoPan: true,
            keepInView: true,
          });

          map.Stones.addLayer(pin)
        })
      })
      .catch(error => {
        console.log(error)
      });

    fetch('json/shipPaths.json', {
        dataType: 'json'
      })
      .then(res => res.json())
      .then(function (paths) {
        paths.forEach(path => {
          let pathing = [];

          let n = path.Nodes[0];
          let center = [n.worldX, n.worldY];
          let previous = rotateVector2DAroundAxis([n.worldX - n.controlPointsDistance, n.worldY], center, n.rotation);
          let next = rotateVector2DAroundAxis([n.worldX + n.controlPointsDistance, n.worldY], center, n.rotation);

          pathing.push('M', unrealToLeaflet(n.worldX, n.worldY))
          pathing.push('C', unrealToLeafletArray(next), unrealToLeafletArray(previous), unrealToLeafletArray(center))

          path.Nodes.push(path.Nodes.shift());
          for (var i = 0; i < path.Nodes.length; i++) {
            n = path.Nodes[i];
            center = [n.worldX, n.worldY];
            previous = rotateVector2DAroundAxis([n.worldX - n.controlPointsDistance, n.worldY], center, n.rotation);
            pathing.push('S', unrealToLeafletArray(previous), unrealToLeafletArray(center))
          }

          var p = L.curve(pathing, {
            color: path.AutoSpawnShipClass.indexOf('GhostShip') !== -1 ? 'red' : 'darkgray',
            dashArray: '10',
            opacity: 0.8
          });
          if (path.AutoSpawnShipClass.indexOf('GhostShip') !== -1) {
            map.GhostShips.addLayer(p.addTo(map));
          } else {
            map.Ships.addLayer(p);
          }
        })
      })
      .catch(error => {
        console.log(error)
      });

    fetch('json/islands.json', {
        dataType: 'json'
      })
      .then(res => res.json())
      .then(function (islands) {
        for (let k in islands) {

          if (islands[k].isControlPoint) {
            var pin = new L.Marker(unrealToLeaflet(islands[k].worldX, islands[k].worldY), {
              icon: CPIcon,
            });
            pin.bindPopup(`Control Point`, {
              showOnMouseOver: true,
              autoPan: true,
              keepInView: true,
            });

            map.ControlPoints.addLayer(pin)
            continue;
          }

          if (islands[k].animals || islands[k].resources) {
            let circle = new IslandCircle(unrealToLeaflet(islands[k].worldX, islands[k].worldY), {
              radius: 1.5,
              color: "#f00",
              opacity: 0,
              fillOpacity: 0.1,
            });

            circle.animals = [];
            circle.resources = [];
            circle.animals = islands[k].animals.slice();
            circle.name = islands[k].name;

            let html = `<b>${islands[k].name} - ${islands[k].id}</b><ul class='split-ul'>`;
            for (let resource in circle.animals.sort()) {
              html += "<li>" + circle.animals[resource] + "</li>";
            }
            html += "</ul>";
            if (islands[k].resources) {
              let resources = [];
              for (let key in islands[k].resources) {
                if (key.length > 2)
                  circle.resources.push(key);
              }
              circle.resources.sort();

              html += "<ul class='split-ul'>";
              circle.resources.forEach(function (v) {
                html += "<li>" + v + " (" + islands[k].resources[v] + ")</li>";
              });
              html += "</ul>";
            }
            circle.bindPopup(html, {
              showOnMouseOver: true,
              autoPan: false,
              keepInView: true,
              maxWidth: 560
            });
            map.IslandResources.addLayer(circle);
          }
          if (islands[k].treasureMapSpawnPoints) {
            for (let spawn in islands[k].treasureMapSpawnPoints) {
              let d = islands[k].treasureMapSpawnPoints[spawn].split(" ");
              // Rotate the vector
              d = rotateVector2D(d, islands[k].rotation);
              let circle = new IslandCircle(unrealToLeaflet(islands[k].worldX + parseFloat(d[0]), islands[k].worldY + parseFloat(d[1])), {
                radius: .05,
                color: "#00FF00",
                opacity: 0.5,
                fillOpacity: 0.5,
              });
              map.Treasure.addLayer(circle);
            }
          }
          if (islands[k].discoveries) {
            for (let disco in islands[k].discoveries) {
              let d = islands[k].discoveries[disco];
              let circle = new IslandCircle(GPStoLeaflet(d.long, d.lat), {
                radius: config.DiscoveryRadius,
                color: "#000000",
                opacity: 0.5,
                fillOpacity: 0.5,
              });
              circle.disco = d;
              circle.bindPopup(`${d.name}: ${d.long.toFixed(2)} / ${d.lat.toFixed(2)}`, {
                showOnMouseOver: true,
                autoPan: false,
                keepInView: true,
              });
              map.Discoveries.addLayer(circle);
            }
          }
        }
        refreshFromQuery();
      })
      .catch(error => {
        console.log(error)
      });

    L.Control.MousePosition = L.Control.extend({
      options: {
        position: 'bottomleft',
        separator: ' , ',
        emptyString: 'Unavailable',
        lngFirst: false,
        numDigits: 5,
        lngFormatter: undefined,
        latFormatter: undefined,
        prefix: "",
        clickedCords: null
      },

      onAdd: function (map) {
        this._container = L.DomUtil.create('div', 'leaflet-control-mouseposition');
        L.DomEvent.disableClickPropagation(this._container);
        map.on('mousemove', this._onMouseMove, this);
        map.on('click', this._onMouseClick, this);
        this._container.innerHTML = this.options.emptyString;
        return this._container;
      },

      onRemove: function (map) {
        map.off('mousemove', this._onMouseMove);
        map.off('click', this._onMouseClick);
      },

      _onMouseMove: function (e) {
        if (e.originalEvent.target === this._container) {
          return;
        }
        let lng = L.Util.formatNum(scaleLeafletToAtlas(e.latlng.lng) - 100, 2);
        let lat = L.Util.formatNum(100 - scaleLeafletToAtlas(-e.latlng.lat), 2);
        if (!isOnGrid(e.latlng.lng, -e.latlng.lat)) {
          return;
        }
        let value = lng + this.options.separator + lat;
        let newHtml = this.options.clickedCords ? `<span class="clicked-cords">${this.options.prefix} ${this.options.clickedCords}</span><br/>` : ''
        this._container.innerHTML = '' + newHtml + this.options.prefix + ' ' + value + '';
      },

      _onMouseClick: function (e) {
        let lng = L.Util.formatNum(scaleLeafletToAtlas(e.latlng.lng) - 100, 2);
        let lat = L.Util.formatNum(100 - scaleLeafletToAtlas(-e.latlng.lat), 2);
        if (!isOnGrid(e.latlng.lng, -e.latlng.lat)) {
          return;
        }
        let value = lng + this.options.separator + lat;
        this.options.clickedCords = value;
        let newHtml = this.options.clickedCords ? `<span class="clicked-cords">${this.options.prefix} ${value}</span><br/>` : ''
        this._container.innerHTML = newHtml + this.options.prefix + ' ' + value;
      }
    });

    L.Control.TeleportPosition = L.Control.extend({
      options: {
        position: 'bottomright',
        separator: ' : ',
        emptyString: 'Click map for TP command',
        lngFirst: false,
        numDigits: 5,
        lngFormatter: undefined,
        latFormatter: undefined,
        prefix: ""
      },

      onAdd: function (map) {
        this._container = L.DomUtil.create('div', 'leaflet-control-mouseposition');
        L.DomEvent.disableClickPropagation(this._container);
        map.on('click', this._onMouseClick, this);
        this._container.innerHTML = this.options.emptyString;
        return this._container;
      },

      onRemove: function (map) {
        map.off('click', this._onMouseClick);
      },

      _onMouseClick: function (e) {
        const x = ccc(e.latlng.lng, -e.latlng.lat);
        if (!x[0]) {
          this._container.innerHTML = this.options.emptyString;
        } else {
          this._container.innerHTML = `cheat TP ${x[0]} ${x[1]} ${x[2]} 30000`;
        }
      }
    });

    L.Map.mergeOptions({
      positionControl: false
    });

    L.Map.addInitHook(function () {
      if (this.options.positionControl) {
        this.positionControl = new L.Control.MousePosition();
        this.addControl(this.positionControl);
        this.teleportControl = new L.Control.TeleportPosition();
        this.addControl(this.teleportControl);
      }
    });

    L.control.mousePosition = function (options) {
      return new L.Control.MousePosition(options);
    };
    L.control.mousePosition().addTo(map);

    L.control.teleportPosition = function (options) {
      return new L.Control.TeleportPosition(options);
    };
    L.control.teleportPosition().addTo(map);

  }

  render() {
    return (<div id = "worldmap"> </div>)
  }
}

class App extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      notification: {},
      entities: {},
      tribes: {},
      sending: false,
    }
  }

  render() {
    const {
      notification
    } = this.state
    return ( <div className = "App">
      <WorldMap/>
      <div className = {
        "notification " + (notification.type || "hidden")
      }> {
        notification.msg
      } <button className = "close" onClick={
        () => this.setState({
          notification: {}
        })}> Dismiss </button> </div> </div>
    )
  }
}

function scaleLeafletToAtlas(e) {
  return (e / 1.28);
}

function GPStoLeaflet(x, y) {
  let long = (y - 100) * 1.28,
    lat = (100 + x) * 1.28;
  return [long, lat];
}

function unrealToLeaflet(x, y) {
  const unreal = config.GridSize * Math.max(config.ServersX, config.ServersY);
  let lat = ((x / unreal) * 256),
    long = -((y / unreal) * 256);
  return [long, lat];
}

function unrealToLeafletArray(a) {
  return unrealToLeaflet(a[0], a[1]);
}

function constraint(value, minRange, maxRange, minVal, maxVal) {
  return (
    ((value - minVal) / (maxVal - minVal)) * (maxRange - minRange)
    + minRange
  );
}

function unconstraint(value, minRange, maxRange, minVal, maxVal) {
  return (minVal * maxRange - minVal * value - maxVal * minRange + maxVal * value) / (maxRange- minRange);
}

function isOnGrid(x, y) {
  const precision = (256 / config.ServersX);
  const gridX = gridXName[Math.floor(x / precision)];
  const gridY = Math.floor(y / precision) + 1;
  return gridX && gridY > 0 && gridY <= config.ServersY;
}

const gridXName = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].splice(0, config.ServersX);
function ccc(x, y) {
  const precision = (256 / config.ServersX);
  const gridX = gridXName[Math.floor(x / precision)];
  const gridY = Math.floor(y / precision) + 1;
  const localX = constraint(x % precision, -700000, 700000, 0, precision).toFixed(0);
  const localY = constraint(y % precision, -700000, 700000, 0, precision).toFixed(0);
  return [gridX && gridY > 0 && gridY <= config.ServersY ? gridX + gridY : null, localX, localY];
}

function tpCmdToXY(xLetter, yGrid, x, y) {
  const precision = (256 / config.ServersX);
  const gridX = gridXName.indexOf(xLetter ? xLetter.toUpperCase() : '');
  const gridY = yGrid - 1;
  const gpsX = unconstraint(x, -700000, 700000, 0, precision);
  const gpsY = unconstraint(y, -700000, 700000, 0, precision);
  return [scaleLeafletToAtlas(precision * gridX + gpsX) - 100,
    100 - scaleLeafletToAtlas(precision * gridY + gpsY)];
}

ReactDOM.render( <
  App refresh = {
    5 * 1000 /* 5 seconds */
  }
  />,
  document.getElementById("app")
)

class IslandCircle extends L.Circle {
  constructor(latlng, options) {
    super(latlng, options)
    this.Island = null
    this.bindPopup = this.bindPopup.bind(this)
    this._popupMouseOut = this._popupMouseOut.bind(this)
    this._getParent = this._getParent.bind(this)
  }
  bindPopup(htmlContent, options) {
    if (options && options.showOnMouseOver) {
      L.Marker.prototype.bindPopup.apply(this, [htmlContent, options]);
      this.off("click", this.openPopup, this);
      this.on("mouseover", function (e) {
        var target = e.originalEvent.fromElement || e.originalEvent.relatedTarget;
        var parent = this._getParent(target, "leaflet-popup");
        if (parent == this._popup._container)
          return true;
        this.openPopup();
      }, this);
      this.on("mouseout", function (e) {
        var target = e.originalEvent.toElement || e.originalEvent.relatedTarget;
        if (this._getParent(target, "leaflet-popup")) {
          L.DomEvent.on(this._popup._container, "mouseout", this._popupMouseOut, this);
          return true;
        }
        this.closePopup();
      }, this);
    }
  }
  _popupMouseOut(e) {
    L.DomEvent.off(this._popup, "mouseout", this._popupMouseOut, this);
    var target = e.toElement || e.relatedTarget;
    if (this._getParent(target, "leaflet-popup"))
      return true;
    if (target == this._path)
      return true;
    this.closePopup();
  }
  _getParent(element, className) {
    if (element == null)
      return false;
    var parent = element.parentNode;
    while (parent != null) {
      if (parent.className && L.DomUtil.hasClass(parent, className))
        return parent;
      parent = parent.parentNode;
    }
    return false;
  }
}

function rotateVector2D(vec, ang) {
  if (ang === 0) {
    return vec;
  }

  ang = ang * (Math.PI / 180);
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const r = new Array(vec[0] * cos - vec[1] * sin, vec[0] * sin + vec[1] * cos, vec[0]);

  return r;
}

function rotateVector2DAroundAxis(vec, axis, ang) {
  ang = ang * (Math.PI / 180);
  var cos = Math.cos(ang);
  var sin = Math.sin(ang);

  // Translate to axis
  vec[0] -= axis[0];
  vec[1] -= axis[1];

  const r = new Array(vec[0] * cos - vec[1] * sin, vec[0] * sin + vec[1] * cos);

  // Translate back to world
  r[0] += axis[0];
  r[1] += axis[1];

  return r;
}
