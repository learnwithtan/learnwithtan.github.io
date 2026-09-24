# Learn With Tan

A static website for Dr. Tanveer Syed, PhD: science education consulting, tutoring, and a YouTube lesson library. The design uses a black background, white text, and dark green buttons with white outlines.

## Preview locally

Install Node.js 22 or newer, then run:

```sh
npm start
```

Open <http://127.0.0.1:4173>. No dependencies or install step are needed. `npm run dev` runs the same preview server. To choose another port, run `npm start -- --port 8080` or set the `PORT` environment variable. The preview server only exposes the public site files and supports directory URLs such as `/lessons/` and `/admin/`.

Run the automated checks with:

```sh
npm test
```

## Publish at learnwithtan.github.io

The [learnwithtan organization](https://github.com/learnwithtan) and [website repository](https://github.com/learnwithtan/learnwithtan.github.io) are set up under **jemsbhai**.

For a fresh deployment:

1. Use the GitHub organization **learnwithtan**. This exact account name is necessary for the requested address.
2. Use its public repository named **learnwithtan.github.io**.
3. Add these files to the repository's **main** branch.
4. In the repository's **Settings → Pages**, select **GitHub Actions** as the build and deployment source.
5. Open **Actions → Deploy Learn With Tan** and run the workflow, or push a commit to `main`.
6. Once deployment succeeds, open <https://learnwithtan.github.io>.

The included workflow publishes only the HTML pages, `lessons/`, `admin/`, `assets/`, `data/`, `robots.txt`, `sitemap.xml`, and `.nojekyll`. It does not publish developer documentation, scripts, or tests. GitHub deployment can take several minutes after a change. See GitHub's [site creation guide](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) and [custom workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

GitHub Pages limits sites primarily directed at running an online business or facilitating commercial transactions. This site is an informational profile and lesson library with email contact; that alone is not a guarantee of eligibility. If its primary purpose becomes selling paid consulting, confirm eligibility with GitHub or use a different host. See [GitHub Pages usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Site configuration

Edit `assets/js/site-config.js` before publishing if the repository details differ:

| Field            | Expected value           | Purpose                                          |
| ---------------- | ------------------------ | ------------------------------------------------ |
| `githubOwner`    | `learnwithtan`           | GitHub user or organization                      |
| `githubRepo`     | `learnwithtan.github.io` | Repository that stores the site                  |
| `githubBranch`   | `main`                   | Branch used for publishing                       |
| `videosPath`     | `data/videos.json`       | Lesson data file in the repository               |
| `ADMIN_PASSWORD` | `TanLessons2026!`        | Convenience password for the hidden admin screen |

Use `main` for both the configuration and deployment workflow. If you rename the branch, update both. If the website URL changes, also update canonical URLs and `sitemap.xml`.

## Add a video lesson

No lesson URLs have been supplied, so the initial library is empty.

1. Create a [GitHub fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) while signed in to an account that can write to the site repository. Select **Resource owner → learnwithtan**, set a suitable expiration, select **Only select repositories → learnwithtan.github.io**, and grant **Repository permissions → Contents: Read and write**. No Actions, Administration, or Workflows permission is needed to add lessons. Organization policies may require approval.
2. Open `https://learnwithtan.github.io/admin/` directly. The public navigation does not link to it, and the page asks search engines not to index it.
3. Enter the convenience password from `assets/js/site-config.js`.
4. Enter the GitHub token, a YouTube video link, and the lesson details, then publish the lesson.
5. Wait for the GitHub Pages deployment to finish, then reload the lessons page.

The admin page adds lessons by committing `data/videos.json` to the configured GitHub branch. GitHub authenticates and authorizes that write with the token. The token is kept only in memory for the current page session, never committed or saved in browser storage. Reloading or closing the page requires entering it again. A token used during local preview still writes to the configured GitHub repository; previewing the site itself does not publish anything.

The hard-coded password is visible in the public JavaScript and can be bypassed. It only hides the editing screen from casual visitors; it does **not** protect repository writes or make the admin page private. GitHub Pages cannot securely support password-only publishing because it has no server-side authentication. The repository-scoped GitHub token supplies the real authorization. Do not replace it with a token embedded in the site, and do not reuse an important password for this cosmetic gate.

The interface only adds lessons. To correct or remove one, edit `data/videos.json` in GitHub and commit the change. Its structure is:

```json
{
  "videos": [
    {
      "id": "YOUTUBE_ID",
      "title": "Lesson title",
      "description": "A short description.",
      "category": "Research methods",
      "addedAt": "2026-09-24T12:00:00.000Z"
    }
  ]
}
```

`id` is the 11-character YouTube video ID, not the entire URL. The example is illustrative and is not seeded into the live library. The admin accepts supported YouTube links and extracts their video IDs. To publish edits, the token owner must have permission to write to the configured branch; branch rules requiring pull requests will prevent direct publishing. GitHub's [repository contents API documentation](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents) describes the write permission used here.
