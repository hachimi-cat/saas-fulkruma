package fulkruma

import "fmt"

// Error is the single error type returned by every operation in this
// package. Mirrors the Node SDK's FulkrumaError: an HTTP status (0 for
// transport-level failures), an opaque code, a human message, and the
// optional upstream request id from the {meta:{requestId}} envelope.
type Error struct {
	Status    int
	Code      string
	Message   string
	RequestID string
}

func (e *Error) Error() string {
	if e.RequestID != "" {
		return fmt.Sprintf("fulkruma: %s: %s (status=%d request_id=%s)",
			e.Code, e.Message, e.Status, e.RequestID)
	}
	return fmt.Sprintf("fulkruma: %s: %s (status=%d)", e.Code, e.Message, e.Status)
}

func newErr(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}

func newErrWithReqID(status int, code, message, requestID string) *Error {
	return &Error{Status: status, Code: code, Message: message, RequestID: requestID}
}
