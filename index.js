const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const qs = require("qs");

const { App } = require("@slack/bolt");
const signature = require("./verifySignature");
const appHome = require("./appHome");
const message = require("./message");

const app = express();
require('dotenv').config()

const apiUrl = "https://slack.com/api";
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, // enable the following to use socket mode
  appToken: process.env.APP_TOKEN,
});

slackApp.event("app_home_opened", async ({ payload, client }) => {
  const userId = payload.user;
  try {
    // Call the views.publish method using the WebClient passed to listeners
    const result = await client.views.publish({
      user_id: userId,
      view: {
        // Home tabs must be enabled in your app configuration page under "App Home"
        "type": "home",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Welcome home, <@" + userId + "> :house:*"
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Learn how home tabs can be more useful and interactive <https://api.slack.com/surfaces/tabs/using|*in the documentation*>."
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "context",
            "elements": [
              {
                "type": "mrkdwn",
                "text": "Psssst this home tab was designed using <https://api.slack.com/tools/block-kit-builder|*Block Kit Builder*>"
              }
            ]
          }
        ]
      }
    });

    console.log("result", result);
  }
  catch (error) {
    console.error("errors", error);
  }
});

const rawBodyBuffer = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
};

app.use(bodyParser.urlencoded({ verify: rawBodyBuffer, extended: true }));
app.use(bodyParser.json({ verify: rawBodyBuffer }));

/*
 * Endpoint to receive events from Events API.
 */

app.post("/slack/events", async (req, res) => {
  const { type, user, channel, tab, text, subtype } = req.body.event;
  switch (type) {
    case "url_verification": {
      // verify Events API endpoint by returning challenge if present
      res.send({ challenge: req.body.challenge });
      break;
    }

    case "event_callback": {
      // Verify the signing secret
      if (!signature.isVerified(req)) {
        res.sendStatus(404);
        return;
      }

      // Request is verified --
      else {
        const { type, user, channel, tab, text, subtype } = req.body.event;

        // Triggered when the App Home is opened by a user
        if (type === "app_home_opened") {
          console.log("Hello home")
          // Display App Home
          appHome.displayHome(user);
        }
      }
      break;
    }

    case "app_home_opened": {
      console.log("Hello home")
      // Display App Home
      appHome.displayHome(user);
    }

    default: {
      res.sendStatus(404);
    }
  }
});

async function publishMessage(id, text) {
  try {
    const result = await slackApp.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: id,
      text: text.text,
    });
  } catch (error) {
    console.error(error);
  }
}



async function publishMessageInHome() {
  try {
    // Call the views.publish method using the WebClient passed to listeners
    const result = await slackApp.views.publish({
      user_id: "U041QE5BYTD",
      view: {
        // Home tabs must be enabled in your app configuration page under "App Home"
        "type": "home",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Welcome home, <@" + userId + "> :house:*"
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Learn how home tabs can be more useful and interactive <https://api.slack.com/surfaces/tabs/using|*in the documentation*>."
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "context",
            "elements": [
              {
                "type": "mrkdwn",
                "text": "Psssst this home tab was designed using <https://api.slack.com/tools/block-kit-builder|*Block Kit Builder*>"
              }
            ]
          }
        ]
      }
    });

    console.log(result);
  }
  catch (error) {
    console.error(error);
  }

}

//publishMessageInHome();
publishMessage(process.env.CHANNEL_ID, {
  type: "section",
  text: "Hello World",
});

app.get("/post-message", async (req, res) => {
  const response = await publishMessage(process.env.CHANNEL_ID, {
    type: "section",
    text: "Hello World",
  });
  res.send(response);
})

app.post("/slack/actions", async (req, res) => {
  //console.log(JSON.parse(req.body.payload));

  const { token, trigger_id, user, actions, type } = JSON.parse(
    req.body.payload
  );

  // Button with "add_" action_id clicked --
  if (actions && actions[0].action_id.match(/add_/)) {
    // Open a modal window with forms to be submitted by a user
    appHome.openModal(trigger_id);
  }

  // Modal forms submitted --
  else if (type === "view_submission") {
    res.send(""); // Make sure to respond to the server to avoid an error

    const ts = new Date();
    const { user, view } = JSON.parse(req.body.payload);

    const data = {
      timestamp: ts.toLocaleString(),
      note: view.state.values.note01.content.value,
      color: view.state.values.note02.color.selected_option.value,
    };

    appHome.displayHome(user.id, data);
  }
});

/* Running Express server */
const server = app.listen(process.env.PORT || 3000, () => {
  console.log(
    "Express web server is running on port %d in %s mode",
    server.address().port,
    app.settings.env
  );
});

app.get("/", async (req, res) => {
  res.send(
    'There is no web UI for this code sample. To view the source code, click "View Source"'
  );
});
