import json
import argparse

from jinja2 import Environment, FileSystemLoader
import dateutil.parser

env = Environment(loader=FileSystemLoader("."))


class Team:
    def __init__(self, js):
        self.tricode = js["teamTricode"]
        self.score = js["score"]


def make_play_by_play(args, pbp, boxscore):
    awayTeam = Team(boxscore["game"]["awayTeam"])
    homeTeam = Team(boxscore["game"]["homeTeam"])

    print(boxscore["game"]["gameTimeLocal"])

    dt = dateutil.parser.parse(boxscore["game"]["gameTimeLocal"])
    print(type(dt))
    print(dt.strftime("%a %b %d"))

    actions = pbp["game"]["actions"]
    for a in actions:
        a["clock2"] = a["clock"].replace("PT", "").replace("M", ".")[:-4]
    # for action in actions:
    #     if "teamTricode" in action:
    #         print(
    #             f"{action['clock']} {action['scoreAway']}-{action['scoreHome']} {action['teamTricode']} {action['description']}"
    #         )
    #     else:
    #         print(
    #             f"{action['clock']} {action['scoreAway']}-{action['scoreHome']} {action['description']}"
    #         )

    if args.output is not None:
        with open(args.output, "w") as f:
            templ = env.get_template("template.html")
            f.write(
                templ.render(
                    gameId=pbp["game"]["gameId"],
                    awayTeam=awayTeam,
                    homeTeam=homeTeam,
                    gameTime=dt.strftime("%a %b %d"),
                    actions=actions,
                )
            )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-o", "--output")
    parser.add_argument("-p", "--play-by-play")
    parser.add_argument("-b", "--boxscore")
    args = parser.parse_args()

    with open(args.play_by_play, "r") as f0:
        with open(args.boxscore, "r") as f1:
            make_play_by_play(args, json.load(f0), json.load(f1))


if __name__ == "__main__":
    main()
