import { Line, Circle, Text, Chart } from "./chart.js"

const POINTS_BY_ACTION = {
  "freethrow": 1,
  "2pt": 2,
  "3pt": 3,
};
const SECONDS_IN_REGULAR_PERIOD = 12 * 60;
const SECONDS_IN_OVERTIME_PREIOD = 5 * 60;
// const STROKE_STYLE_HOME = "rgb(255, 198, 39)";
// const STROKE_STYLE_AWAY = "rgb(12, 35, 64)";

const STROKE_STYLE_HOME = "rgb(29, 66, 138)";
const STROKE_STYLE_AWAY = "rgb(200, 16, 46)";
const STROKE_STYLE_GRID = "rgb(200, 200, 200)";
const TEXT_STYLE = "rgb(100, 100, 100)";
const SCORE_RADIUS = 6;
const FONT_FAMILY = "Roboto";


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

function makeScoreSeries(playbyplay, teamTricode, style) {
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
      new Line(x0, y0, x1, y0, 2, style),
      new Line(x1, y0, x1, y1, 2, style),
    );
    series.circles.push(
      new Circle(elapsed, score, SCORE_RADIUS, style, fill, action),
    )

    last_score = [elapsed, score];
  });

  return series;
}

function makeGuide(maxY, config) {
  const line = new Line(0, 0, 0, 0, config.lineWidth, config.style);
  const lineDiff = new Line(0, 0, 0, 0, config.lineWidth * 2, config.style);
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

function makeBoxscoreElement(team, color, tableColor, mouseEnter, mouseLeave) {
  const headerColor = "bg-" + color;
  const borderColor = "border-" + color;
  const caption = document.createElement("caption");
  caption.className = "font-bold";
  caption.append(document.createTextNode(team["teamName"]));

  const header = ["#", "PLAYER", "POS", "MIN", "FGM", "FGA", "FG%", "PTS", "REB", "AST", "TO"];

  const headTr = document.createElement("tr");
  headTr.className = headerColor + " text-white";
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

    const tr = document.createElement("tr");
    tr.className = "hover:font-bold"
    tr.append(
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

    tr.addEventListener("mouseenter", () => { mouseEnter(player); });
    tr.addEventListener("mouseleave", () => { mouseLeave(player); });

    return tr;
  }));

  const table = document.createElement("table")
  table.className = `table-auto border ${borderColor} ${tableColor}`
  table.append(caption, thead, tbody)

  const root = document.createElement("div");
  root.className = "absolute p-2";
  root.append(table);

  const object = {
    root: root,
  };
  return object;
}

function addBoxscore(circles, chart, redraw, boxscore, pos, color, tableColor) {
  let selectedPlayer = null;

  const mouseEnter = (player) => {
    // console.log("mouseEnter")
    selectedPlayer = { "player": player, "color": null };

    circles.forEach(obj => {
      if (obj.props["personId"] == player["personId"]) {
        obj.r = SCORE_RADIUS + 2;
        selectedPlayer.color = obj.primaryStyle;
        // obj.primaryStyle = "rgb(255, 195, 0)";
        obj.primaryStyle = "#93c5fd";
      }
    });
    redraw();
  };

  const mouseLeave = (player) => {
    // console.log("mouseLeave")
    circles.forEach(obj => {
      if (obj.props["personId"] == selectedPlayer.player["personId"]) {
        obj.r = SCORE_RADIUS;
        obj.primaryStyle = selectedPlayer.color;
      }
    });
    selectedPlayer = null;
    redraw();
  };

  const obj = makeBoxscoreElement(boxscore, color, tableColor, mouseEnter, mouseLeave);

  const elem = obj.root;
  const ob = new ResizeObserver((e) => {
    if (pos == "top-left") {
      elem.style.top = `${chart.y0}px`;
      elem.style.left = `${chart.x0}px`;
    } else {
      elem.style.top = `${chart.y0 + chart.height - elem.clientHeight}px`;
      elem.style.left = `${chart.x0 + chart.width - elem.clientWidth}px`;
    }
  });
  ob.observe(elem);

  return obj;
}

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
    setAction: (chart, obj, e) => {
      const action = obj.props;
      const src = `https://cdn.nba.com/headshots/nba/latest/260x190/${action["personId"]}.png`;
      dialog.setDescription(action["description"]);
      dialog.setImage(src);
      const [x, y] = chart.toCanvasXY(obj.lx, obj.ly);
      root.style.top = `${y + 10}px`;
      root.style.left = `${x + 10}px`;
    },
  };

  return dialog;
}

function makeActionList(playbyplay, homeTeam, awayTeam) {
  const options = {
    homeColor: "bg-blue-200",
    awayColor: "bg-rose-200",
  };

  const actions = playbyplay["game"]["actions"];

  const getLogoURL = (teamId) => `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`
  const getHeadshotURL = (personId) => `https://cdn.nba.com/headshots/nba/latest/260x190/${personId}.png`;

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

  const makeTdIf = (flag, fn) => {
    if (flag)
      return fn();
    return makeTd("");
  };

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
      makeTdIf(isMade, () => makeTd(
        action["scoreAway"],
        "text-center font-mono" + (isMadeAway ? " font-bold" : ""))),
      makeTdIf(isMade, () => makeTd("-", "text-center font-mono")),
      makeTdIf(isMade, () => makeTd(
        action["scoreHome"],
        "text-center font-mono" + (isMadeHome ? " font-bold" : ""))),
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
  root.className = "relative overflow-auto text-base"
  root.style.height = "800px" // FIXME

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

function getMaxScore(playbyplay) {
  const actions = playbyplay["game"]["actions"]
  const last = actions[actions.length - 1]
  return Math.max(last["scoreAway"], last["scoreHome"])
}

function makeChart(playbyplay, boxscore, widgets, canvas, ctx) {
  const config = {
    guide: {
      lineWidth: 3,
      style: STROKE_STYLE_GRID,
      textStyle: TEXT_STYLE,
    },
  };

  const chart_x0 = 50;
  const chart_y0 = 20;
  const chart_width = canvas.width - 60;
  const chart_height = canvas.height - 100;
  const ytick = 20;

  const lastPeriod = boxscore["game"]["period"];

  const maxScore = getMaxScore(playbyplay)
  const maxX = 4 * SECONDS_IN_REGULAR_PERIOD + (lastPeriod - 4) * SECONDS_IN_OVERTIME_PREIOD;
  const maxY = Math.ceil(maxScore / ytick) * ytick;

  const chart = new Chart(chart_x0, chart_y0, chart_width, chart_height, maxX, maxY)

  chart.addObject(...makeGrid(chart, ytick, lastPeriod));

  const awayTeam = boxscore["game"]["awayTeam"];
  const homeTeam = boxscore["game"]["homeTeam"];
  const teamTricodeAway = awayTeam["teamTricode"]
  const teamTricodeHome = homeTeam["teamTricode"]
  const seriesAway =
    makeScoreSeries(playbyplay, teamTricodeAway, STROKE_STYLE_AWAY);
  const seriesHome =
    makeScoreSeries(playbyplay, teamTricodeHome, STROKE_STYLE_HOME);

  chart.addObject(
    ...seriesAway.lines,
    ...seriesAway.circles,
    ...seriesHome.lines,
    ...seriesHome.circles,
  );

  const guide = makeGuide(maxY, config.guide);
  chart.addObject(...guide.getObjects());

  const onMouseLeaveCircle = (obj, e) => {
    obj.r = SCORE_RADIUS;
    widgets.actionDialog.setVisible(false);
  }

  const onMouseEnterCircle = (obj, e) => {
    obj.r = SCORE_RADIUS + 2;
    widgets.actionDialog.setAction(chart, obj, e);
    widgets.actionDialog.setVisible(true);
  };

  const onMouseMove = (e) => {
    const [cx, cy] = [e.offsetX, e.offsetY];
    const [lx, ly] = chart.toLogical(cx, cy);

    let minDistance = cx;
    let nearestCircle = null;
    let latestCircle = null;

    const circles = [];
    circles.push(...seriesAway.circles, ...seriesHome.circles);

    circles.forEach(obj => {
      const d = cx - chart.getX(obj.lx);
      const dd = Math.abs(d);
      if (dd < minDistance) {
        minDistance = dd;
        if (dd < obj.r)
          nearestCircle = obj;
        if (d >= 0)
          latestCircle = obj;
      }
    });

    circles.forEach(obj => {
      if (obj != nearestCircle && obj.isMouseOn) {
        obj.isMouseOn = false;
        onMouseLeaveCircle(obj, e);
      }
    });

    if (nearestCircle && !nearestCircle.isMouseOn) {
      nearestCircle.isMouseOn = true;
      onMouseEnterCircle(nearestCircle, e);
    }

    if (nearestCircle) {
      widgets.actionList.selectAction(nearestCircle.props["actionNumber"])
    } else {
      widgets.actionList.scrollToElapsed(lx);
    }

    guide.moveTo(lx, nearestCircle ? nearestCircle.props : null);
  }

  const redraw = () => {
    chart.draw(ctx);
  };

  canvas.addEventListener("mouseleave", (e) => {
    guide.setVisible(false);
    redraw();
  });

  canvas.addEventListener("mousemove", (e) => {
    // console.log("mousemove")
    const [cx, cy] = [e.offsetX, e.offsetY];
    if (chart.isin(cx, cy)) {
      guide.setVisible(true);
      onMouseMove(e)

    } else {
      guide.setVisible(false);
    }
    redraw();
  });

  WebFont.load({
    google: {
      families: [FONT_FAMILY],
    },
    active: function() {
      redraw();
    },
  });

  const object = {
    chart: chart,
    redraw: redraw,
    seriesAway: seriesAway,
    seriesHome: seriesHome,
  };
  return object;
}

export function init(elementId, playbyplay, boxscore) {
  console.log(playbyplay)
  console.log(boxscore)

  console.log(playbyplay["game"]["gameId"])
  if (playbyplay["game"]["gameId"] !== boxscore["game"]["gameId"]) {
    console.log("gameId mismatch");
    return;
  }

  const canvas = document.createElement("canvas");
  if (!canvas.getContext)
    return;

  const homeTeam = boxscore["game"]["homeTeam"];
  const awayTeam = boxscore["game"]["awayTeam"];

  const root = document.getElementById(elementId);
  console.log(root.clientWidth)
  console.log(root.clientHeight)

  const width = root.clientWidth;
  const height = root.clientHeight;

  const chartDiv = document.createElement("div");
  chartDiv.className = "relative";
  chartDiv.style.width = `${width}px`;
  chartDiv.style.height = `${height}px`;

  const actionDialog = makeActionDialog();
  chartDiv.appendChild(actionDialog.root);

  const actionList = makeActionList(playbyplay, homeTeam, awayTeam);
  root.parentElement.appendChild(actionList.root);

  canvas.className = "absolute";
  canvas.width = width;
  canvas.height = height;
  chartDiv.appendChild(canvas);

  const widgets = {
    actionDialog: actionDialog,
    actionList: actionList,
  };

  const ctx = canvas.getContext("2d");
  ctx.font = `14px ${FONT_FAMILY},arial,sans`;

  const chart = makeChart(playbyplay, boxscore, widgets, canvas, ctx);

  const boxscoreHome = addBoxscore(chart.seriesHome.circles, chart.chart, chart.redraw, homeTeam, "top-left", "blue-800", "bg-blue-50");
  const boxscoreAway = addBoxscore(chart.seriesAway.circles, chart.chart, chart.redraw, awayTeam, "bottom-right", "rose-700", "bg-rose-50");

  chartDiv.append(boxscoreAway.root);
  chartDiv.append(boxscoreHome.root);

  root.append(chartDiv);
}
