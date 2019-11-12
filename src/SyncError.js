class SyncError {
  constructor(response, data) {
    // Standard error response with message and code in a JSON object
    if (response.headers.get('Content-Type') === 'application/json') {
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
