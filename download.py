import json
from nba_api.live.nba.endpoints import playbyplay, boxscore, scoreboard
from nba_api.stats.endpoints import boxscoreadvancedv3, scoreboardv2, playbyplayv3

# from nba_api.stats.library.parameters import GameDate
from datetime import datetime

# game_id = "0042300232"
# game_id = "0042300224"
# game_id = "0042300235"
# game_id = "0022300274"
# game_id = "0042300237"
# game_id = "0042300301"
game_id = "0042300312"


def download_playbyplay(game_id):
    data = playbyplay.PlayByPlay(game_id)
    # data = playbyplayv3.PlayByPlayV3(game_id)

    with open(f"{game_id}_playbyplay.txt", "w") as f:
        f.write(json.dumps(json.loads(data.get_json()), indent=2))

    with open(f"{game_id}_playbyplay.json", "w") as f:
        f.write(data.get_json())


def download_boxscore(game_id):
    data = boxscore.BoxScore(game_id)

    with open(f"{game_id}_boxscore.txt", "w") as f:
        f.write(json.dumps(json.loads(data.get_json()), indent=2))

    with open(f"{game_id}_boxscore.json", "w") as f:
        f.write(data.get_json())


def download_scoreboard():
    # jdata = scoreboard.ScoreBoard()
    data = scoreboardv2.ScoreboardV2(game_date="2024-05-17")
    print(json.dumps(json.loads(data.get_json()), indent=2))

    # with open(f"{game_id}_scoreboard.json", "w") as f:
    #     f.write(data.get_json())


def download_stats_boxscore(game_id):
    data = boxscoreadvancedv3.BoxScoreAdvancedV3(game_id)
    print(json.dumps(json.loads(data.get_json()), indent=2))


print(str(datetime.now().date()))

download_playbyplay(game_id)
download_boxscore(game_id)
# download_scoreboard()

# download_stats_boxscore(game_id)
