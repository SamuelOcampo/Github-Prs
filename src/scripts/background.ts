import { Octokit } from "octokit";
import { Endpoints } from "@octokit/types";
import moment, { Moment } from "moment";

type userResponse = Endpoints["GET /user"]["response"];
type listUserReposResponse = Endpoints["GET /user/repos"]["response"];
type listPullFilesRequest =
  Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}/files"];
type listPullFilesResponse =
  Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}/files"]["response"];
type listUserPullsResponse =
  Endpoints["GET /repos/{owner}/{repo}/pulls"]["response"];

let octokit: Octokit;

function* asyncGenerator(repos: listUserReposResponse["data"]) {
  for (let repo of repos) {
    yield octokit.rest.pulls
      .list({
        owner: repo.owner.login,
        repo: repo.name,
      })
      .catch(console.info);
  }
}

const changesPromises: Promise<void>[] = [];
const changes: Record<string, any> = {};
async function findChanges(apiURL: string) {
  changesPromises.push(
    new Promise(async (resolve) => {
      const url = apiURL.split(".github.com")[1];
      const data: listPullFilesResponse["data"] = await octokit.paginate(
        `GET ${url}/files` as any,
        {
          per_page: 100,
        },
        (response, done) => {
          return response.data;
        }
      );

      let count = 0;
      data.forEach((d) => (count += d.changes));
      changes[apiURL] = count;
      resolve();
    })
  );
}

async function fetchRepositories() {
  const {
    data: { id },
  } = await octokit.request("GET /user");

  // TODO: Add pagination
  const data = await octokit.paginate(
    "GET /user/repos",
    {
      per_page: 100,
    },
    (response, done) => {
      return response.data;
    }
  );
  const requestedReviews: listUserPullsResponse["data"] = [];

  const x = await Promise.all(asyncGenerator(data));

  for (let pulls of x) {
    if (pulls && pulls.data.length) {
      pulls.data.forEach((pull) => {
        if (pull?.requested_reviewers?.some((y) => y.id == id)) {
          requestedReviews.push(pull);
          findChanges(pull.url);
        }
      });
    }
  }

  await Promise.all(changesPromises);
  console.log(requestedReviews);

  chrome.storage.local.set({
    lastConsulted: moment().unix(),

    prs: requestedReviews.map((r) => {
      const description =
        r.user?.login +
        " - #" +
        r.number +
        ", " +
        moment(r.updated_at).fromNow() +
        " in " +
        r.base.repo.name;

      return {
        id: r.id,
        title: r.title,
        user: r.user?.login,
        userImage: r.user?.avatar_url,
        url: r.html_url,
        labels: r.labels.map((x) => x.name).join(","),
        description,
        changes: changes[r.url],
      };
    }),
  });
}

async function init() {
  const { lastConsulted, token } = await chrome.storage.local.get([
    "lastConsulted",
    "token",
  ]);

  debugger;
  if (!token) {
    chrome.storage.local.clear();
    return;
  } else {
    octokit = new Octokit({
      auth: token,
    });
  }

  if (lastConsulted) {
    const checkDate = moment(moment.unix(lastConsulted)).add(30, "minutes");
    const now = moment();
    if (!now.isSameOrAfter(checkDate)) {
      console.log("No need to load new meetings");
      return;
    }
  }
  fetchRepositories();
}

chrome.runtime.onMessage.addListener(
  ({ type, content }, sender, sendResponse) => {
    console.debug(type, content);

    const handlersByType: Record<string, Function> = {
      async verifyToken() {
        try {
          octokit = new Octokit({
            auth: content,
          });
          await fetchRepositories();
          chrome.storage.local.set({
            token: content,
          });
          return true;
        } catch (e) {
          console.log(e);
          return e;
        }
      },
      async refresh() {
        const { lastConsulted } = await chrome.storage.local.get([
          "lastConsulted",
        ]);
        if (lastConsulted) {
          const checkDate = moment(moment.unix(lastConsulted)).add(
            30,
            "minutes"
          );
          const now = moment();
          if (!now.isSameOrAfter(checkDate)) {
            console.log("No need to load new meetings");
            return;
          }
        }
        fetchRepositories();
      },
    };
    if (!handlersByType[type]) return sendResponse();
    handlersByType[type](content, sender).then(sendResponse);
    return true;
  }
);

init().catch(console.error);
