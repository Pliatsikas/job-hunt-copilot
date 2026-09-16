/**
 * The "Save this job" bookmarklet. It runs on the page the person is reading,
 * takes the title, URL and visible text, and opens /leads/capture on our
 * origin with that payload in the URL fragment.
 *
 * Why a fragment and a top-level navigation: the session cookie is
 * SameSite=Lax, which browsers send on top-level GET navigations and not on
 * cross-site fetches or form POSTs — so this is the one way a click on
 * kariera.gr can reach a signed-in page here. And a fragment is never sent to
 * the server, so the page text does not pass through any request log. The
 * server only ever sees what the person then submits from our own page.
 *
 * Text is capped at ~35k characters: enough for any posting, under every
 * browser's URL limit with room to spare.
 */
export function bookmarkletSource(origin: string): string {
  const code = `(function(){
var t=document.title||'',u=location.href,
b=(document.body&&document.body.innerText||'').replace(/\\s+\\n/g,'\\n').slice(0,35000),
p=encodeURIComponent(JSON.stringify({t:t,u:u,b:b}));
window.open(${JSON.stringify(origin)}+'/leads/capture#'+p,'_blank');
})();`;
  return "javascript:" + encodeURIComponent(code.replace(/\n/g, ""));
}
