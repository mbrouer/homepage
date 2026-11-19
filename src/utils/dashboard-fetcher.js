export default async function dashboardFetcher(resource, init) {
  const response = await fetch(resource, init);

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.replace(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }

    const error = new Error(`Dashboard request failed: HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}
