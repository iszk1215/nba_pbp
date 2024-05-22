// import _playbypay from "./0042300232.json" with {type: "json"}
// import _playbypay from "./0042300224.json" with {type: "json"}
// import _playbypay from "./0042300237_playbyplay.json" with {type: "json"}
// import _boxscore from "./0042300237_boxscore.json" with {type: "json"}
import _playbypay from "./0042300301_playbyplay.json" with {type: "json"}
import _boxscore from "./0042300301_boxscore.json" with {type: "json"}

const POINTS_BY_ACTION = {
  "freethrow": 1,
  "2pt": 2,
  "3pt": 3,
};
const SECONDS_IN_REGULAR_PERIOD = 12 * 60;
const SECONDS_IN_OVERTIME_PREIOD = 5 * 60;
const STROKE_STYLE_HOME = "rgb(255, 198, 39)";
const STROKE_STYLE_AWAY = "rgb(12, 35, 64)";
const STROKE_STYLE_GRID = "rgb(200, 200, 200)";
const SCORE_RADIUS = 5;
const FONT_FAMILY = "Roboto";

class Circle {
  constructor(px, py, r, fillStyle, strokeStyle, props) {
    this.px = px;
    this.py = py;
    this.r = r; // phisical
    this.fillStyle = fillStyle;
    this.strokeStyle = strokeStyle;
    this.isMouseOn = false;
    this.props = props;
  }

  isin(px, py) {
    const d = (this.px - px) * (this.px - px) + (this.py - py) * (this.py - py);
    return d < this.r * this.r;
  }
}

class Chart {
  constructor(x0, y0, width, height, maxX, maxY) {
    this.x0 = x0;
    this.y0 = y0;
    this.width = width;
    this.height = height;
    this.maxX = maxX;
    this.maxY = maxY;
    this.series = []
  }

  addSeries(series) {
    this.series.push(series);
  }

  isin(px, py) {
    return px >= this.x0 && px < this.x0 + this.width
      && py >= this.y0 && py < this.y0 + this.height;
  }

  toLogicalX(x) {
    return (x - this.x0) * this.maxX / this.width;
  }

  toLogicalY(y) {
    return parseInt((this.y0 + this.height - y) * this.maxY / this.height);
  }

  toLogical(x, y) {
    return [this.toLogicalX(x), this.toLogicalY(y)];
  }

  getX(x) {
    // return parseInt(this.x0 + this.width * x / this.maxX);
    return this.x0 + this.width * x / this.maxX;
  }

  getY(y) {
    // return parseInt(this.y0 + this.height - this.height * y / this.maxY);
    return this.y0 + this.height - this.height * y / this.maxY;
  }

  drawLineP(ctx, x0, y0, x1, y1, lineWidth) {
    const offset = 0; lineWidth / 2;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x0 + offset, y0 + offset);
    ctx.lineTo(x1 + offset, y1 + offset);
    ctx.stroke();
  }

  drawLine(ctx, x0, y0, x1, y1, lineWidth) {
    const [x2, y2] = [this.getX(x0), this.getY(y0)];
    const [x3, y3] = [this.getX(x1), this.getY(y1)];
    this.drawLineP(ctx, x2, y2, x3, y3, lineWidth);
  }
} // class Chart

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

function addScoreSeries(chart, playbyplay, teamTricode, style) {
  const actions = playbyplay["game"]["actions"]
  if (actions.length == 0)
    return;

  const actionsWithShotResults = actions.filter(a => a["shotResult"] && a["teamTricode"] === teamTricode)


  const series = []

  let score = 0;
  actionsWithShotResults.forEach(action => {
    if (action["shotResult"] && action["teamTricode"] === teamTricode) {
      const made = action["shotResult"] === "Made";
      if (action["shotResult"] === "Made") {
        score += POINTS_BY_ACTION[action["actionType"]];
      }
      const elapsed = getElapsed(action);
      const x = chart.getX(elapsed);
      const y = chart.getY(score);
      const fillStyle = made ? style : "rgb(255, 255, 255)";

      series.push(new Circle(x, y, SCORE_RADIUS, fillStyle, style, action));
    }
  });

  chart.addSeries(series);
}

function drawPoints(chart, ctx, series, strokeStyle) {
  ctx.strokeStyle = strokeStyle;

  let last_score = [chart.getX(0), chart.getY(0)];
  series.forEach(obj => {
    if (obj.props["shotResult"] !== "Made")
      return;

    const [x0, y0] = last_score;
    chart.drawLineP(ctx, x0, y0, obj.px, y0, 2);
    chart.drawLineP(ctx, obj.px, y0, obj.px, obj.py, 2);

    last_score = [obj.px, obj.py];
  });

  {
    const [x0, y0] = last_score;
    const x1 = chart.getX(chart.maxX);
    chart.drawLineP(ctx, x0, y0, x1, y0, 2);
  }

  series.forEach(obj => {
    const x = obj.px;
    const y = obj.py;
    const r = obj.r;

    ctx.fillStyle = obj.fillStyle;
    ctx.beginPath();
    ctx.arc(x, y, r - 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = obj.strokeStyle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function getMaxScore(playbyplay) {
  const actions = playbyplay["game"]["actions"]
  const last = actions[actions.length - 1]
  return Math.max(last["scoreAway"], last["scoreHome"])
}

function draw(ctx, chart, playbyplay, boxscore, guide) {
  // console.log("draw");
  const lastPeriod = boxscore["game"]["period"];
  const ytick = 20;
  const xtick = SECONDS_IN_REGULAR_PERIOD;

  // ctx.clearRect(0, 0, chart.width, chart.height);

  ctx.strokeStyle = STROKE_STYLE_GRID;

  // grid
  for (let y = 0; y <= chart.maxY; y += ytick)
    chart.drawLine(ctx, 0, y, chart.maxX, y, 1);
  for (let x = 0; x <= chart.maxX; x += xtick)
    chart.drawLine(ctx, x, 0, x, chart.maxY, 1);

  // overtime
  for (let x = SECONDS_IN_REGULAR_PERIOD * 4 + SECONDS_IN_OVERTIME_PREIOD; x <= chart.maxX; x += SECONDS_IN_OVERTIME_PREIOD)
    chart.drawLine(ctx, x, 0, x, chart.maxY, 1);

  // axis label
  {
    ctx.font = `14px ${FONT_FAMILY},arial,sans`;
    ctx.fillStyle = "rgb(100, 100, 100)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    let x;
    let y = chart.getY(0) + 4; // 4 = margin
    x = chart.getX(0 + SECONDS_IN_REGULAR_PERIOD / 2);
    ctx.fillText("Q1", x, y);
    x = chart.getX(0 + SECONDS_IN_REGULAR_PERIOD + SECONDS_IN_REGULAR_PERIOD / 2);
    ctx.fillText("Q2", x, y);
    x = chart.getX(0 + SECONDS_IN_REGULAR_PERIOD * 2 + SECONDS_IN_REGULAR_PERIOD / 2);
    ctx.fillText("Q3", x, y);
    x = chart.getX(0 + SECONDS_IN_REGULAR_PERIOD * 3 + SECONDS_IN_REGULAR_PERIOD / 2);
    ctx.fillText("Q4", x, y);

    for (let ot = 1; ot + 4 <= lastPeriod; ++ot) {

      x = chart.getX(SECONDS_IN_REGULAR_PERIOD * 4
        + SECONDS_IN_OVERTIME_PREIOD * (ot - 1) + SECONDS_IN_OVERTIME_PREIOD / 2);
      ctx.fillText(`OT${ot}`, x, y);
    }

    // y

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let score = 0; score <= chart.maxY; score += ytick) {
      x = chart.getX(0) - 4;
      y = chart.getY(score);
      ctx.fillText(`${score}`, x, y);
    }
  }

  // guide
  if (guide) {
    const [x, y] = guide;
    const [seconds, score] = chart.toLogical(x, y);
    ctx.strokeStyle = STROKE_STYLE_GRID;
    chart.drawLineP(ctx, x, chart.y0, x, chart.y0 + chart.height);
    // chart.drawLineP(ctx, chart.x0, y, chart.x0 + chart.width, y);

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
    ctx.fillText(`${min}:${sec}`, x, chart.getY(0) + 4);

    // score difference
    const obj0 = chart.series[0].findLast(obj => obj.px <= x);
    const obj1 = chart.series[1].findLast(obj => obj.px <= x);
    let diff = 0, py0, py1;
    let latest = null;
    if (obj0 && obj1) {
      latest = obj0.px > obj1.px ? obj0 : obj1;
      py0 = obj0.py;
      py1 = obj1.py;
    } else if (obj0 || obj1) {
      latest = obj0 ? obj0 : obj1;
      py0 = latest.py;
      py1 = 0;
    } else {
    }

    if (latest)
      diff = Math.abs(latest.props["scoreHome"] - latest.props["scoreAway"])

    if (diff > 0) {
      ctx.beginPath();
      ctx.lineWidth = 4;
      chart.drawLineP(ctx, x, py0, x, py1, 4);
      ctx.stroke()
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`${diff}`, x - 4, (py0 + py1) / 2);
    }
  }

  drawPoints(chart, ctx, chart.series[0], STROKE_STYLE_AWAY)
  drawPoints(chart, ctx, chart.series[1], STROKE_STYLE_HOME)
  // console.log("draw: done");
}

function addPane(chart, drawFunc) {
  const parentElement = document.getElementById("pbp-chart");

  const div = document.createElement("div");
  const text = document.createTextNode("hello");
  div.style.position = "absolute";
  div.style.top = "200px";
  div.style.left = "60px";
  div.appendChild(text);
  div.addEventListener("mouseenter", (ev) => {
    console.log("mouseenter");
    chart.series.forEach(series => {
      series.forEach(obj => {
        if (obj.props["personId"] == 1630162) {
          console.log(obj.props["personId"]);
          obj.r = SCORE_RADIUS + 2;
        }
      });
    });
    drawFunc();
  });

  div.addEventListener("mouseleave", (ev) => {
    console.log("mouseleave");
    chart.series.forEach(series => {
      series.forEach(obj => {
        obj.r = SCORE_RADIUS;
      });
    });
    drawFunc();
  });

  parentElement.appendChild(div);
}

function initChart(playbyplay, boxscore, canvas, ctx) {
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

  addScoreSeries(chart, playbyplay, teamTricodeAway, STROKE_STYLE_AWAY);
  addScoreSeries(chart, playbyplay, teamTricodeHome, STROKE_STYLE_HOME);


  //if (canvas.getContext) {
  if (true) {
    // const ctx = canvas.getContext("2d");

    const headshots = {};
    const imageLoaded = {};

    canvas.addEventListener("mousemove", (e) => {
      // console.log("mousemove")
      const [x, y] = [e.offsetX, e.offsetY];
      // console.log(x, y);
      let guide = null;
      let imgObj = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (chart.isin(x, y)) {
        guide = [x, y];

        chart.series.forEach(series => {
          series.forEach(obj => {
            if (obj.isin(x, y)) {
              if (!obj.isMouseOn) {
                obj.isMouseOn = true;
                obj.r = SCORE_RADIUS + 2;
              }
              imgObj = obj;
            } else if (obj.isMouseOn) {
              obj.isMouseOn = false;
              obj.r = SCORE_RADIUS;
            }
          });
        });
      }

      draw(ctx, chart, playbyplay, boxscore, guide);

      if (imgObj) {
        const imgW = 26 * 3;
        const imgH = 16 * 3;
        const personId = imgObj.props["personId"];
        let img = headshots[personId];
        let loaded = imageLoaded[personId];
        if (img) {
          if (loaded) {
            // ctx.drawImage(img, imgObj.px - imgW - 6, imgObj.py - imgH - 6, imgW, imgH);
            ctx.drawImage(img,
              0, 0, 260, 160,
              imgObj.px - imgW - 6, imgObj.py - imgH - 6, imgW, imgH);
          }
        } else {
          const img = new Image();
          headshots[personId] = img;
          //console.log(imgObj.px, imgObj.py);
          img.addEventListener("load", function() {
            imageLoaded[personId] = true;
            ctx.drawImage(img,
              0, 0, 260, 160,
              imgObj.px - imgW - 6, imgObj.py - imgH - 6, imgW, imgH);
          });
          const url = `https://cdn.nba.com/headshots/nba/latest/260x190/${imgObj.props["personId"]}.png`;
          img.src = url;
        }
      }
      // console.log("mousemove done")
    });

    WebFont.load({
      google: {
        families: [FONT_FAMILY],
      },
      active: function() {
        draw(ctx, chart, playbyplay, boxscore);
      },
    });


    addPane(chart, () => { draw(ctx, chart, playbyplay, boxscore); });
  }
}

function init(playbyplay, boxscore) {
  console.log(playbyplay)
  console.log(boxscore)

  console.log(playbyplay["game"]["gameId"])
  if (playbyplay["game"]["gameId"] !== boxscore["game"]["gameId"]) {
    console.log("gameId mismatch");
    return;
  }

  const canvas = document.getElementById("pbp");
  if (canvas.getContext) {
    const ctx = canvas.getContext("2d");
    initChart(playbyplay, boxscore, canvas, ctx);
  }
}

init(_playbypay, _boxscore)
