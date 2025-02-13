import { Line, Rect, Circle, Text, Chart } from "./chart.js"

const POINTS_BY_ACTION = {
  "freethrow": 1,
  "2pt": 2,
  "3pt": 3,
};
const SECONDS_IN_REGULAR_PERIOD = 12 * 60;
const SECONDS_IN_OVERTIME_PREIOD = 5 * 60;

const STROKE_STYLE_HOME = "rgb(29, 66, 138)";
const STROKE_STYLE_AWAY = "rgb(200, 16, 46)";
const STROKE_STYLE_GRID = "rgb(200, 200, 200)";
const TEXT_STYLE = "rgb(100, 100, 100)";
const SCORE_RADIUS = 6;
const FONT_FAMILY = "Roboto";

function call_if(fn, ...args) {
  if (fn)
    return fn(...args);
}

function getHeadshotURL(personId) {
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${personId}.png`;
}

function getElapsed(action) {
  const period = parseInt(action["period"])
  const clock = action["clock"];
  const min = parseInt(clock[2]) * 10 + parseInt(clock[3]);
  const sec = parseInt(clock[5]) * 10 + parseInt(clock[6]);
  const subsec = parseInt(clock[8]) * 0.1 + parseInt(clock[9]) * 0.01;
  const clock_in_sec = min * 60 + sec + subsec;

  if (period < 5) {
    return SECONDS_IN_REGULAR_PERIOD * (period - 1) + SECONDS_IN_REGULAR_PERIOD - clock_in_sec;
  }

  // overtime 
  return SECONDS_IN_REGULAR_PERIOD * 4 + SECONDS_IN_OVERTIME_PREIOD - clock_in_sec;
}

function formatElapsed(elapsed) {
  let clock;
  let seconds_in_period = elapsed;
  if (elapsed < SECONDS_IN_REGULAR_PERIOD * 4) {
    while (seconds_in_period > SECONDS_IN_REGULAR_PERIOD) {
      seconds_in_period -= SECONDS_IN_REGULAR_PERIOD;
    }
    clock = SECONDS_IN_REGULAR_PERIOD - seconds_in_period;
  } else {
    seconds_in_period -= SECONDS_IN_REGULAR_PERIOD * 4;
    while (seconds_in_period > SECONDS_IN_OVERTIME_PREIOD) {
      seconds_in_period -= SECONDS_IN_OVERTIME_PREIOD;
    }
    clock = SECONDS_IN_OVERTIME_PREIOD - seconds_in_period;
  }
  const min = String(parseInt(clock / 60)).padStart(2, "0");
  const sec = String(parseInt(clock - 60 * min)).padStart(2, "0");

  return `${min}:${sec}`;
}

function makeTh(text, className) {
  const th = document.createElement("th");
  if (className)
    th.className = className;
  th.appendChild(document.createTextNode(text));
  return th;
}

function makeTd(text, className) {
  const td = document.createElement("td");
  td.className = `before:content-['${text.replaceAll(" ", "_")}'] `
    + "before:font-bold before:invisible before:block before:h-0"
    + (className ? " " + className : "");
  td.appendChild(document.createTextNode(text));
  return td;
}

/*
 * Grid
 */

function makeGrid(chart, ytick, lastPeriod) {
  const objects = [];

  // y grid
  for (let y = 0; y <= chart.maxY; y += ytick)
    objects.push(new Line(0, y, chart.maxX, y, 1, STROKE_STYLE_GRID));

  // x grid
  for (let x = 0; x <= 4 * SECONDS_IN_REGULAR_PERIOD; x += SECONDS_IN_REGULAR_PERIOD)
    objects.push(new Line(x, 0, x, chart.maxY, 1, STROKE_STYLE_GRID));

  // overtime
  for (let x = SECONDS_IN_REGULAR_PERIOD * 4 + SECONDS_IN_OVERTIME_PREIOD;
    x <= chart.maxX;
    x += SECONDS_IN_OVERTIME_PREIOD)
    objects.push(new Line(x, 0, x, chart.maxY, 1, STROKE_STYLE_GRID));

  // x axis label
  for (let i = 0; i < 4; ++i) {
    const x = SECONDS_IN_REGULAR_PERIOD * i + SECONDS_IN_REGULAR_PERIOD / 2;
    objects.push(new Text({
      text: `Q${i + 1}`,
      x: x,
      y: 0,
      offsetY: 4,
      textAlign: "center",
      textBaseline: "top",
    }));
  }

  for (let i = 4; i < lastPeriod; ++i) {
    const x = SECONDS_IN_REGULAR_PERIOD * 4
      + SECONDS_IN_OVERTIME_PREIOD * (i - 4) + SECONDS_IN_OVERTIME_PREIOD / 2;
    objects.push(new Text({
      text: `OT${i - 3}`,
      x: x,
      y: 0,
      offsetY: 4,
      textAlign: "center",
      textBaseline: "top",
    }));
  }

  // y axis label
  for (let score = 0; score <= chart.maxY; score += ytick) {
    objects.push(new Text({
      text: `${score}`,
      x: 0,
      y: score,
      offsetX: -4,
      textAlign: "right",
      textBaseline: "middle",
    }));
  }

  return objects
}


/*
 * BoxScore
 */

function makeBoxscore(team, config, teamType) {
  const self = {
    teamType: teamType,
    callbacks: {
      mouseEnter: null,
      mouseLeave: null,
    },
    setMouseEnter: (fn) => { self.callbacks.mouseEnter = fn; },
    setMouseLeave: (fn) => { self.callbacks.mouseLeave = fn; },
  };

  const caption = document.createElement("caption");
  caption.className = "font-bold";
  caption.append(document.createTextNode(team["teamName"]));

  const header = ["", "#", "PLAYER", "POS", "MIN", "FGM", "FGA", "FG%", "PTS", "REB", "AST", "TO"];

  const headTr = document.createElement("tr");
  headTr.className = config.headerColor + " text-white";
  headTr.append(...header.map(text => makeTh(text, "text-center")));

  const thead = document.createElement("thead");
  thead.className = "font-bold text-sm";
  thead.append(headTr)

  const players = team["players"].filter(player => player["played"] != "0")
  const tbody = document.createElement("tbody");
  tbody.append(...players.map((player, i) => {
    const stats = player["statistics"];
    const fga = stats["fieldGoalsAttempted"];
    const fgm = stats["fieldGoalsMade"];
    const fgp = (fgm / fga * 100).toFixed(1);

    const tdClass = "text-right px-1 font-mono";

    const checkbox = document.createElement("input");
    checkbox.setAttribute("type", "checkbox");
    checkbox.className = config.accentColor;
    const checkboxTd = document.createElement("td");
    checkboxTd.append(checkbox);
    checkboxTd.className = "px-1";

    const tr = document.createElement("tr");
    tr.className = "hover:font-bold"
    tr.append(
      checkboxTd,
      makeTd(player["jerseyNum"], tdClass),
      makeTd(player["nameI"], "px-1"),
      makeTd(player["starter"] == "1" ? player["position"] : "", ""),
      makeTd(
        stats["minutes"].replace("PT", "").replace("M", ":").replace(/\..*/, ""),
        tdClass),
      makeTd(fgm.toString(), tdClass),
      makeTd(fga.toString(), tdClass),
      makeTd(fgp.toString(), tdClass),
      makeTd(stats["points"].toString(), tdClass),
      makeTd(stats["reboundsTotal"].toString(), tdClass),
      makeTd(stats["assists"].toString(), tdClass),
      makeTd(stats["turnovers"].toString(), tdClass),
    );

    tr.addEventListener(
      "mouseenter", () => { call_if(self.callbacks.mouseEnter, player, self.teamType); });
    tr.addEventListener(
      "mouseleave", () => { call_if(self.callbacks.mouseLeave, player, self.teamType); });

    return tr;
  }));

  const table = document.createElement("table")
  table.className = `table-auto w-full border ${config.borderColor} ${config.tableColor}`
  table.append(caption, thead, tbody)

  const root = document.createElement("div");
  // root.className = "absolute p-2";
  root.append(table);

  self.root = root;
  return self;
}

function addBoxscore(widgets, boxscore, pos) {
  const mouseEnter = (player, team) => {
    widgets.chart.selectPlayer(player, team);
    widgets.actionDialog.setVisible(false);
  };

  const mouseLeave = (player, team) => {
    widgets.chart.deselectPlayer(player, team);
  };

  boxscore.setMouseEnter(mouseEnter)
  boxscore.setMouseLeave(mouseLeave)

  /*
  const elem = boxscore.root;
  const ob = new ResizeObserver((e) => {
    const helper = widgets.chart.helper
    if (pos == "top-left") {
      elem.style.top = `${helper.y0}px`;
      elem.style.left = `${helper.x0}px`;
    } else {
      elem.style.top = `${helper.y0 + helper.height - elem.clientHeight}px`;
      elem.style.left = `${helper.x0 + helper.width - elem.clientWidth}px`;
    }
  });
  ob.observe(elem);
  */

  return boxscore;
}

/*
 * ActionDialog
 */

function makeActionDialog() {
  const root = document.createElement("div");
  root.className = "p-1 absolute z-10 border-solid border border-black shadow-xl bg-white invisible";

  const description = document.createTextNode("");
  root.appendChild(description);

  const img = document.createElement("img");
  img.width = 26 * 3;
  img.height = 16 * 3;
  root.appendChild(img);

  const dialog = {
    root: root,
    setDescription: (text) => { description.nodeValue = text; },
    setImage: (src) => { img.src = src },
    setVisible: (flag) => {
      if (flag) {
        root.classList.remove("invisible");
        root.classList.add("visible");
      } else {
        root.classList.remove("visible");
        root.classList.add("invisible");
      }
    },
    setAction: (chart, action, elapsed, score) => {
      const src = getHeadshotURL(action["personId"]);
      dialog.setDescription(action["description"]);
      dialog.setImage(src);
      const [x, y] = chart.toCanvasXY(elapsed, score);
      root.style.top = `${y + SCORE_RADIUS + 2}px`;
      root.style.left = `${x + SCORE_RADIUS + 2}px`;
    },
  };

  return dialog;
}

/*
 * ActionList
 */

function makeActionList(playbyplay, homeTeam, awayTeam, options) {
  const getLogoURL = (teamId) => `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`

  const makeTeamTD = (action) => {
    if ("teamId" in action) {
      const img = document.createElement("img");
      img.src = getLogoURL(action["teamId"]);
      img.width = 24;
      const td = document.createElement("td");
      td.append(img);
      return td;
    }
    return makeTd("")
  };

  const makeHeadshotTD = (action) => {
    if (action["personId"]) {
      const img = document.createElement("img");
      img.src = getHeadshotURL(action["personId"]);
      img.width = 26;
      img.height = 16;

      const td = document.createElement("td");
      td.append(img);
      return td;
    }
    return makeTd("");
  };

  const makeTdIf = (flag, text, className) => {
    if (flag)
      return makeTd(text, className);
    return makeTd("");
  };

  const actions = playbyplay["game"]["actions"];
  const rows = actions.map(action => {
    const tr = document.createElement("tr");
    const isMade = action["shotResult"] == "Made";
    const isMadeHome = isMade && action["teamTricode"] == homeTeam["teamTricode"];
    const isMadeAway = isMade && action["teamTricode"] == awayTeam["teamTricode"];
    tr.append(
      makeTd(`Q${action["period"]}`, "font-mono pr-1"),
      makeTd(action["clock"]
        .replace("PT", "").replace("M", ":").replace(/\..*/, ""),
        "font-mono pr-1"),
      makeTdIf(
        isMade,
        action["scoreAway"],
        "text-center font-mono" + (isMadeAway ? " font-bold" : "")),
      makeTdIf(isMade, "-", "text-center font-mono"),
      makeTdIf(
        isMade,
        action["scoreHome"],
        "text-center font-mono" + (isMadeHome ? " font-bold" : "")),
      makeTeamTD(action),
      makeHeadshotTD(action),
      makeTd(action["description"]),
    );
    tr.id = `action-${action["actionNumber"]}`

    const obj = {
      tr: tr,
      action: action,
      elapsed: getElapsed(action),
    };
    return obj;
  });

  const header = ["", "Clock", "", "", "", "", "", "Description"];
  const thead = document.createElement("thead");
  const headTr = document.createElement("tr");
  headTr.className = "font-bold sticky top-0 bg-gray-50";
  // headTr.append(...header.map(text => makeTh(text, "text-left")));
  const scoreTh = makeTh("Score", "text-center");
  scoreTh.setAttribute("colSpan", 3);
  const descrTh = makeTh("Description", "text-left");
  descrTh.setAttribute("colSpan", 3);
  headTr.append(
    makeTh(""),
    makeTh("Clock", "text-left"),
    scoreTh,
    descrTh,
  );
  thead.append(headTr);

  const tbody = document.createElement("tbody");
  tbody.append(...rows.map(row => row.tr));
  const table = document.createElement("table");
  table.append(thead);
  table.append(tbody);
  const root = document.createElement("div")
  root.append(table);
  root.className = "overflow-auto text-base"
  root.style.height = `${options.height}px`

  const findNearestRow = (elapsed) => {
    let diff = null;
    let found = null;
    for (let row of rows) {
      found = row;
      const d = elapsed - row.elapsed;
      if (d < 0)
        break;
    }
    return found;
  };

  const object = {
    root: root,
    scrollToElapsed: (elapsed) => {
      const row = findNearestRow(elapsed);
    },
    selectAction: (actionNumber) => {
      const found = rows.find(row => row.action["actionNumber"] == actionNumber);
      if (found) {
        found.tr.scrollIntoView({ block: "center" });
        // console.log(found.action["teamTricode"]);
        const color =
          found.action["teamTricode"] == homeTeam["teamTricode"]
            ? options.homeColor : options.awayColor;
        found.tr.classList.add(color);
      }
      if (object.selected && found != object.selected) {
        object.selected.tr.classList.remove(options.homeColor, options.awayColor);
      }
      object.selected = found;
    },
    selected: null,
  };

  return object;
}

/*
 * Chart
 */

function makeScoreSeries(playbyplay, teamTricode, config) {
  const actions = playbyplay["game"]["actions"]
  if (actions.length == 0)
    return;

  const actionsWithShotResults = actions.filter(
    a => a["shotResult"] && a["teamTricode"] === teamTricode)

  const series = {
    circles: [],
    lines: [],
  };

  let score = 0;
  let last_score = [0, 0];
  actionsWithShotResults.forEach(action => {
    let fill = false;
    if (action["shotResult"] === "Made") {
      score += POINTS_BY_ACTION[action["actionType"]];
      fill = true;
    }
    const elapsed = getElapsed(action);

    const [x0, y0] = last_score;
    const [x1, y1] = [elapsed, score];
    series.lines.push(
      new Line(x0, y0, x1, y0, 2, config.lineStyle),
      new Line(x1, y0, x1, y1, 2, config.lineStyle),
    );
    series.circles.push(
      new Circle(elapsed, score, SCORE_RADIUS, config.primaryStyle, fill, action),
    )

    last_score = [elapsed, score];
  });

  return series;
}

function makeGuide(maxY, config) {
  const line = new Line(0, 0, 0, 0, config.lineWidth, config.lineStyle);
  const lineDiff = new Line(0, 0, 0, 0, config.lineWidth * 2, config.lineStyle);
  const textClock = new Text({
    style: config.textStyle,
    offsetY: 4,
    textAlign: "center",
    textBaseline: "top",
  });
  const textDiff = new Text({
    style: config.textStyle,
    offsetX: -4,
    textAlign: "right",
    textBaseline: "middle",
  });

  const object = {
    setVisible: (visible) => {
      object.getObjects().forEach(obj => obj.setVisible(visible));
    },
    moveTo: (elapsed, action) => {
      // FIXME
      line.moveTo(elapsed, 0, elapsed, maxY);
      if (action) {
        const scoreHome = parseInt(action["scoreHome"]);
        const scoreAway = parseInt(action["scoreAway"]);

        lineDiff.moveTo(elapsed, scoreHome, elapsed, scoreAway);

        const diff = Math.abs(scoreHome - scoreAway);
        textDiff.moveTo(elapsed, (scoreHome + scoreAway) / 2);
        textDiff.setText(diff.toString());
      }

      textClock.moveTo(elapsed, 0);
      textClock.setText(formatElapsed(elapsed));
    },
    getObjects: () => {
      return [line, lineDiff, textClock, textDiff];
    },
  }

  return object;
}

function getMaxScore(playbyplay) {
  const actions = playbyplay["game"]["actions"]
  const last = actions[actions.length - 1]
  return Math.max(last["scoreAway"], last["scoreHome"])
}

function makeChart(dataset, config) {
  const playbyplay = dataset.playbyplay
  const boxscore = dataset.boxscore

  const chart_x0 = 50;
  const chart_y0 = 20;
  const chart_width = config.width - 60;
  const chart_height = config.height - 50;

  const lastPeriod = boxscore["game"]["period"];

  const maxScore = getMaxScore(playbyplay)
  const maxX = 4 * SECONDS_IN_REGULAR_PERIOD + (lastPeriod - 4) * SECONDS_IN_OVERTIME_PREIOD;
  const maxY = Math.ceil(maxScore / config.ytick) * config.ytick;
  console.log("maxX", maxX);

  const tricodeAway = boxscore["game"]["awayTeam"]["teamTricode"]
  const tricodeHome = boxscore["game"]["homeTeam"]["teamTricode"]
  const seriesAway =
    makeScoreSeries(playbyplay, tricodeAway, config.style["away"]);
  const seriesHome =
    makeScoreSeries(playbyplay, tricodeHome, config.style["home"]);

  const guide = makeGuide(maxY, config.guide);

  const chart = new Chart(chart_x0, chart_y0, chart_width, chart_height, maxX, maxY)
  chart.addObject(
    ...seriesAway.lines,
    ...seriesAway.circles,
    ...seriesHome.lines,
    ...seriesHome.circles,
  );
  chart.addObject(...makeGrid(chart, config.ytick, lastPeriod));
  chart.addObject(...guide.getObjects());

  const circles = [...seriesAway.circles, ...seriesHome.circles];

  const findNearest = (e) => {
    const [cx, cy] = [e.offsetX, e.offsetY];

    let minDistance = cx;
    let absMinDistance = cx;
    let nearestCircle = null;
    let latestCircle = null;

    circles.forEach(obj => {
      const d = cx - chart.getX(obj.lx);
      const absDistance = Math.abs(d);
      if (d >= 0 && d < minDistance) {
        minDistance = d;
        latestCircle = obj;
      }
      if (absDistance < obj.r && absDistance < absMinDistance) {
        absMinDistance = absDistance;
        nearestCircle = obj;
      }
    });

    return [nearestCircle, latestCircle];
  };

  const updateCicles = (selectedCircle) => {
    circles.forEach(obj => {
      if (obj != selectedCircle && obj.isMouseOn) {
        obj.isMouseOn = false;
        obj.r = config.shot_radius;
      }
    });

    if (selectedCircle && !selectedCircle.isMouseOn) {
      selectedCircle.isMouseOn = true;
      selectedCircle.r = config.shot_radius + 2;
    }
  }

  const getTeamTricodeOfPlayer = (player) => {
    const away = boxscore["game"]["awayTeam"];
    for (const p of away["players"]) {
      if (p["personId"] == player["personId"])
        return "away";
    }
    return "home";
  }

  const getAwayOrHome = (action) => {
    return action["teamTricode"] == boxscore["game"]["awayTeam"]["teamTricode"]
      ? "away" : "home";
  }

  const countScore = (begin, end) => {
    const actions = playbyplay["game"]["actions"];
    const actionsWithShotMade = actions.filter(
      a => a["shotResult"] && a["shotResult"] == "Made")

    const scoreBoard = { "away": 0, "home": 0 };

    actionsWithShotMade.forEach(action => {
      const elapsed = getElapsed(action);
      if (elapsed >= begin && elapsed <= end) {
        const score = POINTS_BY_ACTION[action["actionType"]];
        const awayOrHome = getAwayOrHome(action);
        scoreBoard[awayOrHome] += score;
      }
    });

    return scoreBoard;
  };


  const addPoC = (player) => {
    dataset.players_on_court[player["personId"]].forEach(poc => {
      const home_or_away = getTeamTricodeOfPlayer(player);
      const rect = new Rect(poc.begin, 0, poc.end - poc.begin, maxY,
        config.style[home_or_away].player_on_court);
      rect.tag = "poc";
      chart.addObject(rect);
      const scoreBoard = countScore(poc.begin, poc.end);
      console.log(scoreBoard);
    });

  };

  const removePoC = () => {
    chart.setObjects(chart.objects.filter((obj) => obj.tag != "poc"))
  };

  const onMouseMove = (e, callback) => {
    const [cx, cy] = [e.offsetX, e.offsetY];
    const [lx, ly] = chart.toLogical(cx, cy);

    let [selectedCircle, latestCircle] = findNearest(e)
    let elapsed = lx;
    let selectedAction = null;
    let selectedActionScore = null;
    if (selectedCircle) {
      latestCircle = selectedCircle;
      elapsed = selectedCircle.lx;
      selectedAction = selectedCircle.props;
      selectedActionScore = selectedCircle.ly;
    }

    updateCicles(selectedCircle);

    guide.moveTo(elapsed, latestCircle ? latestCircle.props : null);
    if (callback)
      callback(chart, elapsed, selectedAction, selectedActionScore);
  }

  const canvas = document.createElement("canvas");
  if (!canvas.getContext) {
    console.log("canvas does not support 2d context");
    return null;
  }

  // canvas.className = "border border-green-400"
  canvas.width = config.width;
  canvas.height = config.height;
  const ctx = canvas.getContext("2d");
  ctx.font = config.font;

  const self = {
    root: canvas,
    helper: chart,
    redraw: () => { chart.draw(ctx); },
    series: {
      away: seriesAway,
      home: seriesHome,
    },
    onMouseMoveCallback: null,
    selectedPlayer: null,
    selectPlayer: (player, team) => {
      self.selectedPlayer = player;
      const series = self.series[team];
      series.lines.forEach(obj => {
        obj.strokeStyle = config.style[team].grayStyle;
      });
      series.circles.forEach(obj => {
        if (obj.props["personId"] == player["personId"]) {
          obj.r = config.shot_radius + 2;
        } else {
          obj.primaryStyle = config.style[team].grayStyle;
        }
      });

      addPoC(player);
      self.redraw();
    },
    deselectPlayer: (player, team) => {
      const series = self.series[team];
      series.lines.forEach(obj => {
        obj.strokeStyle = config.style[team].lineStyle;
      });
      series.circles.forEach(obj => {
        if (obj.props["personId"] == player["personId"]) {
          obj.r = config.shot_radius;
        } else {
          obj.primaryStyle = config.style[team].primaryStyle;
        }
      });
      self.selectedPlayer = null;
      removePoC();
      self.redraw();
    },
  };

  canvas.addEventListener("mouseleave", (e) => {
    guide.setVisible(false);
    self.redraw();
  });

  canvas.addEventListener("mousemove", (e) => {
    const [cx, cy] = [e.offsetX, e.offsetY];
    if (chart.isin(cx, cy)) {
      guide.setVisible(true);
      onMouseMove(e, self.onMouseMoveCallback)
    } else {
      guide.setVisible(false);
    }
    self.redraw();
  });

  return self;
}

export function init(elementId, playbyplay, boxscore, players_on_court) {
  console.log(playbyplay["game"]["gameId"])
  console.log(playbyplay)
  console.log(boxscore)
  console.log(players_on_court)

  if (playbyplay["game"]["gameId"] !== boxscore["game"]["gameId"]) {
    console.log("gameId mismatch");
    return;
  }

  const options = {
    actionList: {
      height: 900,
      homeColor: "bg-blue-200",
      awayColor: "bg-rose-200",
    },
    boxscore: {
      away: {
        tableColor: "bg-rose-50",
        headerColor: "bg-rose-800",
        borderColor: "border-rose-800",
        accentColor: "accent-rose-800",
      },
      home: {
        tableColor: "bg-blue-50",
        headerColor: "bg-blue-800",
        borderColor: "border-blue-800",
        accentColor: "accent-blue-800",
      },
    },
    chart: {
      width: 1200,
      height: 900,
      ytick: 20,
      font: `14px ${FONT_FAMILY},arial,sans`,
      shot_radius: SCORE_RADIUS,
      style: {
        away: {
          lineStyle: STROKE_STYLE_AWAY,
          grayStyle: STROKE_STYLE_GRID,
          primaryStyle: STROKE_STYLE_AWAY,
          player_on_court: "#ffe4e6", // rose-100
        },
        home: {
          lineStyle: STROKE_STYLE_HOME,
          grayStyle: STROKE_STYLE_GRID,
          primaryStyle: STROKE_STYLE_HOME,
          player_on_court: "#dbeafe", // blue-100
        },
      },
      guide: {
        lineWidth: 3,
        lineStyle: STROKE_STYLE_GRID,
        textStyle: TEXT_STYLE,
      },
    },
  };

  const dataset = {
    playbyplay: playbyplay,
    boxscore: boxscore,
    players_on_court: players_on_court,
  }

  const homeTeam = boxscore["game"]["homeTeam"];
  const awayTeam = boxscore["game"]["awayTeam"];

  const actionDialog = makeActionDialog();
  const actionList = makeActionList(playbyplay, homeTeam, awayTeam, options.actionList);

  const chart = makeChart(dataset, options.chart);
  const boxscoreAway = makeBoxscore(awayTeam, options.boxscore.away, "away");
  const boxscoreHome = makeBoxscore(homeTeam, options.boxscore.home, "home");

  const widgets = {
    actionDialog: actionDialog,
    actionList: actionList,
    chart: chart,
  };

  const onMouseMoveCallback = (chartHelper, elapsed, action, score) => {
    if (action) {
      widgets.actionList.selectAction(action["actionNumber"])
      widgets.actionDialog.setAction(chartHelper, action, elapsed, score);
      widgets.actionDialog.setVisible(true);
    } else {
      widgets.actionList.scrollToElapsed(elapsed);
      widgets.actionDialog.setVisible(false);
    }

  };

  chart.onMouseMoveCallback = onMouseMoveCallback;

  WebFont.load({
    google: {
      families: [FONT_FAMILY],
    },
    active: function() {
      chart.redraw();
    },
  });

  addBoxscore(widgets, boxscoreHome, "top-left");
  addBoxscore(widgets, boxscoreAway, "bottom-right");

  const boxScoreContainer = document.createElement("div");
  boxScoreContainer.append(boxscoreAway.root);
  boxScoreContainer.append(boxscoreHome.root);
  boxScoreContainer.className = "w-full";

  const root = document.getElementById(elementId);
  // root.className = "flex relative border border-red-500";
  root.className = "flex relative";
  root.append(chart.root);
  root.append(boxScoreContainer);
  //root.append(boxscoreAway.root);
  //root.append(boxscoreHome.root);
  // root.appendChild(actionList.root);
  root.appendChild(actionDialog.root);
}
