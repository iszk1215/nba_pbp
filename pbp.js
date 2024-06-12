// import _playbypay from "./0042300232.json" with {type: "json"}
// import _playbypay from "./0042300224.json" with {type: "json"}
// import _playbypay from "./0042300237_playbyplay.json" with {type: "json"}
// import _boxscore from "./0042300237_boxscore.json" with {type: "json"}
// import _playbypay from "./0042300301_playbyplay.json" with {type: "json"}
// import _boxscore from "./0042300301_boxscore.json" with {type: "json"}
import _playbypay from "./data/0042300312_playbyplay.json" with {type: "json"}
import _boxscore from "./data/0042300312_boxscore.json" with {type: "json"}
import { Line, Circle, Chart } from "./chart.js"

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
  } else { // overtime 
    return SECONDS_IN_REGULAR_PERIOD * 4 + SECONDS_IN_OVERTIME_PREIOD - clock_in_sec;
  }
}

function addAxis(chart, boxscore) {
  const lastPeriod = boxscore["game"]["period"];
  const ytick = 20;
  const xtick = SECONDS_IN_REGULAR_PERIOD;

  // grid
  for (let y = 0; y <= chart.maxY; y += ytick)
    chart.addObject(new Line(0, y, chart.maxX, y, 1, STROKE_STYLE_GRID));
  for (let x = 0; x <= chart.maxX; x += xtick)
    chart.addObject(new Line(x, 0, x, chart.maxY, 1, STROKE_STYLE_GRID));

  // overtime
  for (let x = SECONDS_IN_REGULAR_PERIOD * 4 + SECONDS_IN_OVERTIME_PREIOD; x <= chart.maxX; x += SECONDS_IN_OVERTIME_PREIOD)
    chart.addObject(new Line(x, 0, x, chart.maxY, 1, STROKE_STYLE_GRID));
}

function addScoreSeries(chart, playbyplay, teamTricode, style) {
  const actions = playbyplay["game"]["actions"]
  if (actions.length == 0)
    return;

  const actionsWithShotResults = actions.filter(
    a => a["shotResult"] && a["teamTricode"] === teamTricode)

  const series = []

  let score = 0;
  let last_score = [0, 0];
  actionsWithShotResults.forEach(action => {
    if (action["shotResult"] && action["teamTricode"] === teamTricode) {
      let fill = false;
      if (action["shotResult"] === "Made") {
        score += POINTS_BY_ACTION[action["actionType"]];
        fill = true;
      }
      const elapsed = getElapsed(action);

      const [x0, y0] = last_score;
      const [x1, y1] = [elapsed, score];
      chart.addObject(new Line(x0, y0, x1, y0, 2, style));
      chart.addObject(new Line(x1, y0, x1, y1, 2, style));

      const circle = new Circle(elapsed, score, SCORE_RADIUS, style, fill, action);
      series.push(circle);
      chart.addObject(circle);

      last_score = [elapsed, score];
    }
  });

  chart.addSeries(series);
}

function drawGuide(ctx, chart, guide) {
  const [cx, cy] = chart.toCanvasXY(guide[0], guide[1]);
  const [seconds, score] = guide;
  ctx.strokeStyle = STROKE_STYLE_GRID;
  chart.drawLineP(ctx, cx, chart.y0, cx, chart.y0 + chart.height);

  let clock;
  let seconds_in_period = seconds;
  if (seconds < SECONDS_IN_REGULAR_PERIOD * 4) {
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

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`${min}:${sec}`, cx, chart.getY(0) + 4);

  // score difference
  const obj0 = chart.series[0].findLast(obj => obj.lx <= seconds);
  const obj1 = chart.series[1].findLast(obj => obj.lx <= seconds);

  let diff = 0, ly0, ly1;
  let latest = null;
  if (obj0 && obj1) {
    latest = obj0.lx > obj1.lx ? obj0 : obj1;
    ly0 = obj0.ly;
    ly1 = obj1.ly;
  } else if (obj0 || obj1) {
    latest = obj0 ? obj0 : obj1;
    ly0 = latest.ly;
    ly1 = chart.getY(0);
  }

  if (latest)
    diff = Math.abs(latest.props["scoreHome"] - latest.props["scoreAway"])

  if (diff > 0) {
    const cy0 = chart.getY(ly0);
    const cy1 = chart.getY(ly1);
    ctx.beginPath();
    ctx.lineWidth = 4;
    chart.drawLineP(ctx, cx, cy0, cx, cy1, 4);
    ctx.stroke()
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${diff}`, cx - 4, (cy0 + cy1) / 2);
  }
}

function draw(ctx, chart, boxscore, guide) {
  // console.log("draw");
  const lastPeriod = boxscore["game"]["period"];
  const ytick = 20;
  const xtick = SECONDS_IN_REGULAR_PERIOD;

  // ctx.clearRect(0, 0, chart.width, chart.height);

  ctx.strokeStyle = STROKE_STYLE_GRID;

  // axis label
  {
    ctx.font = `14px ${FONT_FAMILY},arial,sans`;
    ctx.fillStyle = "rgb(100, 100, 100)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    let y = chart.getY(0) + 4; // 4 = margin

    for (let i = 0; i < 4; ++i) {
      const x = chart.getX(SECONDS_IN_REGULAR_PERIOD * i + SECONDS_IN_REGULAR_PERIOD / 2);
      ctx.fillText(`Q${i + 1}`, x, y);
    }

    // overtime
    for (let i = 4; i < lastPeriod; ++i) {
      const x = chart.getX(SECONDS_IN_REGULAR_PERIOD * 4
        + SECONDS_IN_OVERTIME_PREIOD * (i - 4) + SECONDS_IN_OVERTIME_PREIOD / 2);
      ctx.fillText(`OT${i - 3}`, x, y);
    }

    // y
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let score = 0; score <= chart.maxY; score += ytick) {
      const x = chart.getX(0) - 4;
      y = chart.getY(score);
      ctx.fillText(`${score}`, x, y);
    }
  }

  // guide
  if (guide) {
    drawGuide(ctx, chart, guide);
  }

  chart.objects.sort((a, b) => a.zindex - b.zindex);
  chart.objects.forEach(obj => obj.draw(ctx, chart));
}


function makeBoxscoreElement(team, color) {
  const headerColor = "bg-" + color;
  const borderColor = "border-" + color;

  const makeTh = (text) => {
    const th = document.createElement("td");
    th.className = "text-center";
    th.appendChild(document.createTextNode(text));
    return th;
  }

  const makeTd = (text, className) => {
    const td = document.createElement("td");
    td.className = `before:content-['${text.replaceAll(" ", "_")}'] `
      + "before:font-bold before:invisible before:block before:h-0"
      + (className ? " " + className : "");
    td.appendChild(document.createTextNode(text));
    return td;
  };

  const caption = document.createElement("caption");
  caption.className = "font-bold";
  caption.append(document.createTextNode(team["teamName"]));

  const header = ["#", "PLAYER", "POS", "MIN", "FGM", "FGA", "FG%", "PTS", "REB", "AST", "TO"];

  const headTr = document.createElement("tr");
  headTr.className = headerColor + " text-white";
  headTr.append(...header.map(text => makeTh(text)));

  const thead = document.createElement("thead");
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

    return tr;
  }));

  const table = document.createElement("table")
  table.className = `table-auto border ${borderColor} bg-white`
  table.append(caption, thead, tbody)

  const root = document.createElement("div");
  root.append(table);
  return root;
}

function addBoxscore(chart, drawFunc, boxscore, pos, color) {
  const elem = makeBoxscoreElement(boxscore, color);
  elem.classList.add("absolute");

  elem.addEventListener("mouseenter", (ev) => {
    chart.series.forEach(series => {
      series.forEach(obj => {
        if (obj.props["personId"] == 1630162) {
          obj.r = SCORE_RADIUS + 2;
          // obj.fillStyle = "rgb(255, 195, 0)";
        }
      });
    });
    drawFunc();
  });

  elem.addEventListener("mouseleave", (ev) => {
    //console.log("mouseleave");
    chart.series.forEach(series => {
      series.forEach(obj => {
        obj.r = SCORE_RADIUS;
      });
    });
    drawFunc();
  });

  const parentElement = document.getElementById("pbp-chart");
  parentElement.appendChild(elem);

  const ob = new ResizeObserver((e) => {
    if (pos == "top-left") {
      elem.style.top = "55px";
      elem.style.left = "55px";
    } else {
      elem.style.top = `${chart.height - elem.clientHeight + 45}px`;
      elem.style.left = `${chart.width - elem.clientWidth + 45}px`;
    }
  });
  ob.observe(elem);
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

function getMaxScore(playbyplay) {
  const actions = playbyplay["game"]["actions"]
  const last = actions[actions.length - 1]
  return Math.max(last["scoreAway"], last["scoreHome"])
}

function initChart(playbyplay, boxscore, actionDialog, canvas, ctx) {
  canvas.width = 1900;
  canvas.height = 900;

  const chart_x0 = 50;
  const chart_y0 = 50;
  const chart_width = 1200;
  const chart_height = 800;

  const lastPeriod = boxscore["game"]["period"];

  const maxScore = getMaxScore(playbyplay)
  const maxX = 4 * SECONDS_IN_REGULAR_PERIOD + (lastPeriod - 4) * SECONDS_IN_OVERTIME_PREIOD;
  // const maxY = Math.max(maxScore, 120)
  const maxY = Math.ceil(maxScore / 20) * 20;

  const chart = new Chart(chart_x0, chart_y0, chart_width, chart_height, maxX, maxY)

  const teamTricodeAway = boxscore["game"]["awayTeam"]["teamTricode"]
  const teamTricodeHome = boxscore["game"]["homeTeam"]["teamTricode"]

  addAxis(chart, boxscore);
  addScoreSeries(chart, playbyplay, teamTricodeAway, STROKE_STYLE_AWAY);
  addScoreSeries(chart, playbyplay, teamTricodeHome, STROKE_STYLE_HOME);

  const headshots = {};
  const imageLoaded = {};

  canvas.addEventListener("mouseleave", (e) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx, chart, boxscore, null);
  });

  const onMouseLeave = (obj, e) => {
    obj.r = SCORE_RADIUS;
    actionDialog.setVisible(false);
  }

  const onMouseEnter = (obj, e) => {
    obj.r = SCORE_RADIUS + 2;
    actionDialog.setAction(chart, obj, e);
    actionDialog.setVisible(true);
  };

  canvas.addEventListener("mousemove", (e) => {
    // console.log("mousemove")
    const [cx, cy] = [e.offsetX, e.offsetY];
    const [lx, ly] = chart.toLogical(cx, cy);
    // console.log(x, y);
    let guide = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (chart.isin(cx, cy)) {
      guide = [lx, ly];

      let objOnMouse = null;

      chart.objects.forEach(obj => {
        if (obj.isin && obj.isin(lx, ly)) {
          objOnMouse = obj;
        } else if (obj.isMouseOn) {
          obj.isMouseOn = false;
          onMouseLeave(obj, e);
        }
      });

      if (objOnMouse) {
        const obj = objOnMouse;
        obj.isMouseOn = true;
        onMouseEnter(obj, e);
      }
    }

    draw(ctx, chart, boxscore, guide);
    // console.log("mousemove done")
  });

  WebFont.load({
    google: {
      families: [FONT_FAMILY],
    },
    active: function() {
      draw(ctx, chart, boxscore);
    },
  });


  const homeTeam = boxscore["game"]["homeTeam"];
  const awayTeam = boxscore["game"]["awayTeam"];
  const callback = () => { draw(ctx, chart, boxscore); };
  addBoxscore(chart, callback, homeTeam, "top-left", "blue-800");
  addBoxscore(chart, callback, awayTeam, "bottom-right", "rose-700");
}

function init(playbyplay, boxscore) {
  console.log(playbyplay)
  console.log(boxscore)

  console.log(playbyplay["game"]["gameId"])
  if (playbyplay["game"]["gameId"] !== boxscore["game"]["gameId"]) {
    console.log("gameId mismatch");
    return;
  }

  const root = document.getElementById("pbp-chart");
  root.className = "relative border";

  const actionDialog = makeActionDialog();
  root.appendChild(actionDialog.root);

  const canvas = document.createElement("canvas");
  canvas.className = "absolute";
  root.appendChild(canvas);

  // const canvas = document.getElementById("pbp");
  if (canvas.getContext) {
    const ctx = canvas.getContext("2d");
    initChart(playbyplay, boxscore, actionDialog, canvas, ctx);
  }

  const box = document.getElementById("box");
  // box.className = "hidden";
}

init(_playbypay, _boxscore)
