class SyncError {
  constructor(response) {
    // Standard error response with message and code in a JSON object
    if (response.headers.get('Content-Type') === 'application/json') {
      const data = JSON.parse(response.text());
      this.message = data.message;
      this.code = data.code;
    } else {
      this.message = response.statusText;
      this.code = response.status;
    }
    this.status = response.status;
  }
}
export default SyncError;
