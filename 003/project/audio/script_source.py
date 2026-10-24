"""Source of truth for the Notice 003 narration.

Each beat is one TTS request (about 350 to 600 characters). Each line is one
caption unit and one audio segment after alignment. Speaker W lines are the
handwriting on the back of the photograph: shown as amber captions, never voiced.
Running this file writes script.json.
"""
import json
import os

H, T1, T2, T3, T4, R, E, O = "hook", "thing1", "thing2", "thing3", "thing4", "reveal", "escape", "turn"

BEATS = [
    ("B01", [
        (H, "If you find a photo of yourself you never took... keep it."),
        (H, "Do not throw it away. Do not show it to anyone."),
        (H, "And do not try to remember when it happened."),
        (H, "You already looked at it twice."),
        (H, "You told yourself it was someone who looks like you."),
        (H, "It is not. You have your own ears."),
        (H, "A photograph needs a photographer."),
        (H, "You would remember a flash."),
        (H, "So someone stood close enough to take it, and you did not notice."),
        (H, "Management has prepared a short briefing."),
        (H, "It will last as long as the photograph stays in your hand."),
        (H, "Check the corner."),
    ]),
    ("B02", [
        (H, "A photographer usually stands a few metres away."),
        (H, "This one stood forty metres away."),
        (H, "That is a great deal of faith to place in a zoom lens."),
        (H, "Four things will happen. Each one brings the photographer closer."),
        (H, "After that, we need to talk about when it was taken."),
        (T1, "One. It was taken from far away."),
        (T1, "Look at the edges. The frame is slightly crooked."),
        (T1, "Like someone was trying very hard not to be seen."),
        (T1, "Now look at what you are doing in it."),
    ]),
    ("B03", [
        (T1, "Nothing. A bus stop. A coffee. Staring at nothing in particular."),
        (T1, "Not posing. Not performing. Not holding your stomach in."),
        (T1, "You have not looked like that in a photograph for years."),
        (T1, "Here is the only rule that matters today."),
        (T1, "Do not ask who took it. Ask when."),
        (T1, "Asking who sends you looking for a stranger."),
        (T1, "And strangers are a poor use of an evening."),
        (T1, "You have been checking faces on the street since you found it."),
        (T1, "It was not them. Management counted. You checked forty one."),
    ]),
    ("B04", [
        (T2, "Two. It will not stay the same."),
        (T2, "Put it down. Look away. Look back."),
        (T2, "There is a scarf now."),
        (T2, "You do not own a scarf like that. Not yet."),
        (T2, "And the photograph has started turning up in other places."),
        (T2, "In your phone, between two pictures you do remember."),
        (T2, "On a shelf, behind someone on a video call."),
        (T2, "In a photo booth strip, between three strangers pulling faces."),
        (T2, "In the window of a shop you only ever walk past."),
        (T2, "Do not go looking for the others."),
        (T2, "In every one of them, you look tidy and unbothered."),
        (T2, "That is not a keepsake. That is a trailer."),
    ]),
    ("B05", [
        (T3, "Three. You are not alone in it."),
        (T3, "At the edge of the frame, there is a hand on your shoulder."),
        (T3, "Someone is standing beside you, cropped out."),
        (T3, "Whoever it is, you are laughing at something they said."),
        (T3, "Look at that laugh. The real one."),
        (T3, "The one that escapes before you can manage it."),
        (T3, "Nobody gets that face on request."),
        (T3, "People photograph you saying cheese."),
        (T3, "Cheese is a performance. This is not cheese."),
        (T3, "Do not ask whose hand it is. Ask when."),
        (T3, "Now turn it over."),
        (T3, "W", "(Keep it.)"),
        (T3, "It is in your handwriting."),
        (T3, "Do not compare it with your own. Do not hold it to the light."),
        (T3, "You have done both."),
        (T3, "Management has compared it. It is yours."),
    ]),
    ("B06", [
        (T4, "Four. It will be warm."),
        (T4, "Warm like it just came out of the camera. Warm like a hand."),
        (T4, "Each time you look, the laugh is a little wider."),
        (T4, "The photograph is not finished. Neither is the moment."),
        (T4, "Management finds this the most unsettling item on the list."),
        (T4, "Do not put it in a drawer."),
        (T4, "A drawer is where you keep things you are afraid of."),
        (T4, "Keep it where you can see it."),
        (T4, "It is the only photograph you own that is still happening."),
    ]),
    ("B07", [
        (R, "Now. When it was taken."),
        (R, "Check the corner."),
        (R, "You asked how close. Wrong unit."),
        (R, "It was never far away in space. It was far away in time."),
        (R, "Nobody followed you. The photograph has not happened yet."),
        (R, "You are looking at a Tuesday that has not arrived."),
        (R, "The scarf. The hand on your shoulder. The laugh."),
        (R, "All of it is on its way."),
        (R, "You have been bracing for next year like a weather report."),
        (R, "And someone sent you the one good photograph from it."),
        (R, "In advance. With a note."),
        (R, "It is a generous thing to send. It is a poor way to deliver it."),
        (R, "And you spent the evening checking strangers."),
    ]),
    ("B08", [
        (E, "So here is how you keep it."),
        (E, "Do nothing about it."),
        (E, "Do not look for the bus stop. Do not buy the scarf."),
        (E, "Do not try to arrange the laugh. Moments built on purpose come out stiff."),
        (E, "Go to work. Come home. Pass the photograph on the way to the kettle."),
        (E, "And live the days in between."),
        (E, "All four hundred and twelve. The ordinary ones too."),
        (E, "The bad ones are part of the route."),
        (E, "Do not hurry the date. Do not pose."),
        (E, "The number will shrink without your help."),
    ]),
    ("B09", [
        (E, "Check the corner."),
        (E, "And then, on an ordinary Tuesday, someone beside you will say something small."),
        (E, "You will laugh before you can manage it."),
        (E, "Somewhere, a shutter clicks. Right on time."),
        (O, "One more thing."),
        (O, "Earlier, Management told you not to show it to anyone."),
        (O, "Management has reviewed that advice."),
        (O, "Frame it. Put it where people can see it."),
        (O, "Management has to correct the record."),
        (O, "Nobody was following you. Nobody took anything from you."),
    ]),
    ("B10", [
        (O, "It was never surveillance. It was only ever a reminder."),
        (O, "That one day, someone is going to be glad you were there."),
        (O, "The handwriting was yours."),
        (O, "You will write it about four hundred and twelve days from now."),
        (O, "Tomorrow, you may find another one."),
        (O, "That is fine. It is only the good days, arriving early."),
        (O, "Keep them."),
        (O, "Management regrets the misunderstanding."),
    ]),
]


def build():
    beats = []
    n = 0
    for bid, items in BEATS:
        lines = []
        for it in items:
            n += 1
            if len(it) == 3:
                lines.append({"id": f"L{n:03d}", "speaker": it[1], "text": it[2], "section": it[0]})
            else:
                lines.append({"id": f"L{n:03d}", "speaker": "N", "text": it[1], "section": it[0]})
        voiced = " ".join(i["text"] for i in lines if i["speaker"] == "N")
        beats.append({"id": bid, "section": lines[0]["section"], "text": voiced, "chars": len(voiced), "lines": lines})
    return beats


if __name__ == "__main__":
    beats = build()
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "script.json"), "w") as f:
        json.dump(beats, f, indent=1)
    words = 0
    for b in beats:
        w = len(b["text"].split())
        words += w
        print(b["id"], b["section"], b["chars"], "chars", w, "words", len(b["lines"]), "lines")
    print("total words", words, "lines", sum(len(b["lines"]) for b in beats))
