# Website move to GitHub pages

## Instructions

- [Configuring](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) a publishing source for your GitHub Pages site
  - Site will appear at <https://alissonsol.github.io/alissonsol.com>
- Managing a [custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) for your GitHub Pages site
  - Here there was some debugging...
    - Didn't work
      - Went to the [Settings -> Pages](https://github.com/alissonsol/alissonsol.com/settings/pages)
      - In the Custom domain, I entered `alissonsol.com`
      - Created the DNS record in [Google Domains -> DNS](https://domains.google.com/registrar/alissonsol.com/dns) pointing `www.alissonsol.com` to `alissonsol.github.io`
      - It kept showing the previous content coming from the [static web site in Azure](https://docs.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website)
    - What was the problem?
      - Not DNS itself
        - `dig www.alissonsol.com` pointed to the correct server (in GitHub)
        - `dig alissonsol.com` pointed to the correct server (in Azure)
      - What about the content?
        - `curl www.alissonsol.com`
        - `curl alissonsol.com`
        - Something was wrong, even after the updates
      - The epiphany came looking at the top of [Settings -> Pages](https://github.com/alissonsol/alissonsol.com/settings/pages)
        - Text was `Your site is live at http://alissonsol.com`
        - There was a redirect web forwarding rule in [Google Domains -> Website](https://domains.google.com/registrar/alissonsol.com/webhost)
          - Removed it
      - In the Custom domain, I entered `www.alissonsol.com`
        - Now, Pages was working, but there was an error message
          - `alissonsol.com is improperly configured`
          - `Domain does not resolve to the GitHub Pages server.`
        - Moreover, the content of `www.alissonsol.com` and just `alissonsol.com` were different
        - That said, somehow the `www` site got a certificate! Automagically...

    - Getting rid of the error message in Pages
      - Also had an `A` record for `alissonsol.com`
        - It pointed to `52.239.163.161`, which is in Azure
        - Since one cannot have a CNAME for the root domain, just deleted that
      - In the Custom domain, I reverted to `alissonsol.com`
        - Checked deploymented in [GitHub -> Actions](https://github.com/alissonsol/alissonsol.com/actions)
        - For a while, it is back to the Azure content
        - Then, it gets worse: `This site can't be reached`
        - Ok, so `alissonsol.com` needs the `A` record, pointing to the same IPs as `alissonsol.github.io`
        - Did that in [Google Domains -> DNS](https://domains.google.com/registrar/alissonsol.com/dns)
        - And now the sites work, got `DNS check successful` and both pages show the GitHub content
        - Yet, both pages are `Not secure`!

    - Not all we need is [love](https://www.youtube.com/watch?v=4EGczv7iiEk) or [attention](https://arxiv.org/abs/1706.03762): at times, a certificate is needed!
      - Let's go through [Securing your GitHub Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
        - Use that Virtual Assistant!
          - It sent me back to the [Google Domains -> DNS](https://domains.google.com/registrar/alissonsol.com/dns) to add the CAA record!
            - `dig alissonsol.com CAA`
            - `alissonsol.com.    3600    IN    CAA    0 issue "letencrypt.org"`
          - On the [Settings -> Pages](https://github.com/alissonsol/alissonsol.com/settings/pages), need to check the box to `Enforce HTTPS`
        - Note to self regarding the email configuration
          - It is all pointing to Google (See `dig alissonsol.com MX`)
          - And the [Google Domains -> Email](https://domains.google.com/registrar/alissonsol.com/email) is configured to forward it!
        - What a beauty! [Let It Be](https://www.youtube.com/watch?v=HzvDofigTKQ)!
