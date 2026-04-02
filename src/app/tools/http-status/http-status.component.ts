import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

export type StatusCategory = 'all' | '1xx' | '2xx' | '3xx' | '4xx' | '5xx';

export interface HttpStatusEntry {
  code: number;
  name: string;
  description: string;
  useCase: string;
  detail: string;
  category: '1xx' | '2xx' | '3xx' | '4xx' | '5xx';
}

@Component({
  selector: 'app-http-status',
  templateUrl: './http-status.component.html',
  styleUrls: ['./http-status.component.css'],
  standalone: false
})
export class HttpStatusComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('HTTP Status Code Reference — searchable, color-coded, with detailed explanations. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/http-status')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/http-status')}`;

  // Search & filter
  searchQuery = '';
  activeCategory: StatusCategory = 'all';

  // Detail view
  selectedStatus: HttpStatusEntry | null = null;

  // Copy state
  copied = false;

  // Category metadata
  readonly categories: { key: StatusCategory; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: 'var(--text-muted)' },
    { key: '1xx', label: '1xx Info', color: '#60a5fa' },
    { key: '2xx', label: '2xx Success', color: '#34d399' },
    { key: '3xx', label: '3xx Redirect', color: '#fbbf24' },
    { key: '4xx', label: '4xx Client Error', color: '#fb923c' },
    { key: '5xx', label: '5xx Server Error', color: '#f87171' },
  ];

  // ── Full HTTP status code database ──────────────────────────────────────────
  readonly statusCodes: HttpStatusEntry[] = [
    // 1xx Informational
    { code: 100, name: 'Continue', category: '1xx', description: 'The server has received the request headers and the client should proceed to send the request body.', useCase: 'Large file uploads where the client checks if the server will accept the request before sending the body.', detail: 'The initial part of a request has been received and has not yet been rejected by the server. The server intends to send a final response after the request has been fully received and acted upon. When the request contains an Expect header field that includes a 100-continue expectation, the 100 response indicates that the server wishes to receive the request payload body.' },
    { code: 101, name: 'Switching Protocols', category: '1xx', description: 'The server is switching protocols as requested by the client via the Upgrade header.', useCase: 'WebSocket connections — the client requests an upgrade from HTTP to WebSocket protocol.', detail: 'The server understands and is willing to comply with the client\'s request, via the Upgrade header field, for a change in the application protocol being used on this connection. The server MUST generate an Upgrade header field in the response that indicates which protocol(s) will be switched to immediately after the empty line that terminates the 101 response.' },
    { code: 102, name: 'Processing', category: '1xx', description: 'The server has received and is processing the request, but no response is available yet.', useCase: 'WebDAV operations that take a long time to complete, preventing client timeout.', detail: 'An interim response used to inform the client that the server has accepted the complete request, but has not yet completed it. This status code SHOULD only be sent when the server has a reasonable expectation that the request will take significant time to complete. A WebDAV-specific status code (RFC 2518).' },
    { code: 103, name: 'Early Hints', category: '1xx', description: 'Used to return some response headers before final HTTP message.', useCase: 'Preloading resources — the server sends Link headers early so the browser can start loading CSS/JS before the full response.', detail: 'Indicates to the client that the server is likely to send a final response with the header fields included in the informational response. Primarily used with the Link header to allow browsers to start preloading resources while the server prepares a full response.' },

    // 2xx Success
    { code: 200, name: 'OK', category: '2xx', description: 'The request has succeeded. The meaning depends on the HTTP method used.', useCase: 'Standard successful GET request returning requested resource, or successful POST/PUT completing an action.', detail: 'The request has succeeded. The payload sent in a 200 response depends on the request method. For GET, a representation of the target resource. For POST, a representation of the status of, or results obtained from, the action. The 200 response is cacheable by default.' },
    { code: 201, name: 'Created', category: '2xx', description: 'The request has been fulfilled and a new resource has been created.', useCase: 'REST APIs after successfully creating a new record (e.g., POST /users creates a new user).', detail: 'The request has been fulfilled and has resulted in one or more new resources being created. The primary resource created by the request is identified by either a Location header field in the response or, if no Location field is received, by the effective request URI.' },
    { code: 202, name: 'Accepted', category: '2xx', description: 'The request has been accepted for processing, but the processing has not been completed.', useCase: 'Async operations like batch processing, email sending, or report generation that will complete later.', detail: 'The request has been accepted for processing, but the processing has not been completed. The request might or might not eventually be acted upon, as it might be disallowed when processing actually takes place. There is no facility in HTTP for re-sending a status code from an asynchronous operation.' },
    { code: 203, name: 'Non-Authoritative Information', category: '2xx', description: 'The returned metadata is not exactly the same as available from the origin server.', useCase: 'Proxy servers that modify response headers or add annotations to the original response.', detail: 'The request was successful but the enclosed payload has been modified from that of the origin server\'s 200 OK response by a transforming proxy. This status code allows the proxy to notify recipients when a transformation has been applied.' },
    { code: 204, name: 'No Content', category: '2xx', description: 'The server successfully processed the request but is not returning any content.', useCase: 'Successful DELETE requests or PUT/PATCH updates where no response body is needed.', detail: 'The server has successfully fulfilled the request and there is no additional content to send in the response payload body. Metadata in the response header fields refer to the target resource and its selected representation after the requested action was applied.' },
    { code: 205, name: 'Reset Content', category: '2xx', description: 'The server successfully processed the request and asks the client to reset the document view.', useCase: 'Form submissions — tells the browser to clear the form after successful submission.', detail: 'The server has fulfilled the request and desires that the user agent reset the document view, which caused the request to be sent, to its original state as received from the origin server. This response is primarily intended to allow input for actions to take place via user input, followed by a clearing of the form.' },
    { code: 206, name: 'Partial Content', category: '2xx', description: 'The server is delivering only part of the resource due to a range header sent by the client.', useCase: 'Video streaming and large file downloads — the client requests specific byte ranges.', detail: 'The server is successfully fulfilling a range request for the target resource by transferring one or more parts of the selected representation that correspond to the satisfiable ranges found in the request\'s Range header field.' },
    { code: 207, name: 'Multi-Status', category: '2xx', description: 'A response that conveys information about multiple resources where multiple status codes might be appropriate.', useCase: 'WebDAV batch operations where each sub-request may have its own status.', detail: 'A Multi-Status response conveys information about multiple resources in situations where multiple status codes might otherwise be appropriate. The default Multi-Status response body is a text/xml or application/xml HTTP entity with a multistatus root element. A WebDAV-specific status code.' },
    { code: 208, name: 'Already Reported', category: '2xx', description: 'Members of a DAV binding have already been enumerated in a previous reply and are not included again.', useCase: 'WebDAV — avoids enumerating the same collection members repeatedly in multi-binding scenarios.', detail: 'Used inside a DAV: propstat response element to avoid enumerating the internal members of multiple bindings to the same collection repeatedly. For each binding to a collection inside the request\'s scope, only one will be reported with a 200 status.' },
    { code: 226, name: 'IM Used', category: '2xx', description: 'The server has fulfilled a GET request for the resource, and the response represents one or more instance-manipulations applied to the current instance.', useCase: 'Delta encoding — server sends only the changes since the client\'s last request.', detail: 'The server has fulfilled a GET request for the resource, and the response is a representation of the result of one or more instance-manipulations applied to the current instance. The actual current instance might not be available except by combining this response with other previous or future responses.' },

    // 3xx Redirection
    { code: 300, name: 'Multiple Choices', category: '3xx', description: 'The request has more than one possible response. The user or user agent should choose one of them.', useCase: 'Content negotiation — the server offers different formats (e.g., HTML, JSON, PDF) of the same resource.', detail: 'The target resource has more than one representation, each with its own more specific identifier, and information about the alternatives is being provided so that the user (or user agent) can select a preferred representation. If the server has a preferred choice, the server SHOULD generate a Location header field containing a preferred choice\'s URI reference.' },
    { code: 301, name: 'Moved Permanently', category: '3xx', description: 'The requested resource has been permanently moved to a new URL.', useCase: 'Domain migrations, URL restructuring, or enforcing HTTPS. Search engines update their index.', detail: 'The target resource has been assigned a new permanent URI and any future references to this resource ought to use one of the enclosed URIs. The server SHOULD generate a Location header field in the response containing a preferred URI reference for the new permanent URI. Clients with link-editing capabilities ought to automatically re-link references.' },
    { code: 302, name: 'Found', category: '3xx', description: 'The requested resource resides temporarily at a different URL.', useCase: 'Temporary redirects during maintenance, A/B testing, or after form submission.', detail: 'The target resource resides temporarily under a different URI. Since the redirection might be altered on occasion, the client ought to continue to use the effective request URI for future requests. The server SHOULD generate a Location header field in the response containing a URI reference for the different URI.' },
    { code: 303, name: 'See Other', category: '3xx', description: 'The response to the request can be found at another URI using a GET method.', useCase: 'Post/Redirect/Get pattern — after processing a POST, redirect to a GET endpoint to prevent resubmission.', detail: 'The server is redirecting the user agent to a different resource, as indicated by a URI in the Location header field, which is intended to provide an indirect response to the original request. A user agent can perform a retrieval request targeting that URI (a GET or HEAD request if using HTTP).' },
    { code: 304, name: 'Not Modified', category: '3xx', description: 'The resource has not been modified since the version specified by the request headers.', useCase: 'Browser caching — the client sends If-Modified-Since, and the server confirms the cached version is current.', detail: 'A conditional GET or HEAD request has been received and would have resulted in a 200 OK response if it were not for the fact that the condition evaluated to false. The server is redirecting the client to make use of a previously stored response. The 304 response MUST NOT contain a message-body and thus is always terminated by the first empty line after the header fields.' },
    { code: 307, name: 'Temporary Redirect', category: '3xx', description: 'The request should be repeated with another URI, but future requests should still use the original URI.', useCase: 'Temporary redirects that must preserve the HTTP method (unlike 302 which may change POST to GET).', detail: 'The target resource resides temporarily under a different URI and the user agent MUST NOT change the request method if it performs an automatic redirection to that URI. Since the redirection can change over time, the client ought to continue using the original effective request URI.' },
    { code: 308, name: 'Permanent Redirect', category: '3xx', description: 'The resource has permanently moved and the request method must not change.', useCase: 'Permanent URL changes for APIs where POST/PUT methods must be preserved across the redirect.', detail: 'The target resource has been assigned a new permanent URI and any future references to this resource ought to use one of the enclosed URIs. This status code is similar to 301 Moved Permanently, except that it does not allow changing the request method from POST to GET.' },

    // 4xx Client Error
    { code: 400, name: 'Bad Request', category: '4xx', description: 'The server cannot process the request due to something perceived to be a client error.', useCase: 'Malformed JSON in request body, missing required fields, or invalid query parameters.', detail: 'The server cannot or will not process the request due to something that is perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing). The client SHOULD NOT repeat the request without modifications.' },
    { code: 401, name: 'Unauthorized', category: '4xx', description: 'The request requires user authentication.', useCase: 'Accessing a protected API endpoint without providing valid credentials or an expired token.', detail: 'The request has not been applied because it lacks valid authentication credentials for the target resource. The server generating a 401 response MUST send a WWW-Authenticate header field containing at least one challenge applicable to the target resource. If the request included authentication credentials, then the 401 response indicates that authorization has been refused for those credentials.' },
    { code: 402, name: 'Payment Required', category: '4xx', description: 'Reserved for future use. Originally intended for digital payment schemes.', useCase: 'SaaS applications requiring paid subscriptions, or paywall-protected content.', detail: 'Reserved for future use. The original intention was that this code might be used as part of some form of digital cash or micropayment scheme, but that has not yet happened. Some services use this status code to indicate that the client has exceeded a usage limit or needs to activate payment.' },
    { code: 403, name: 'Forbidden', category: '4xx', description: 'The server understood the request but refuses to authorize it.', useCase: 'Authenticated user trying to access admin-only resources, or IP-blocked requests.', detail: 'The server understood the request but refuses to authorize it. A server that wishes to make public why the request has been forbidden can describe that reason in the response payload. If authentication credentials were provided in the request, the server considers them insufficient to grant access. Unlike 401, re-authenticating will make no difference.' },
    { code: 404, name: 'Not Found', category: '4xx', description: 'The server cannot find the requested resource. The URL is not recognized.', useCase: 'Broken links, deleted pages, mistyped URLs, or requesting a non-existent API resource.', detail: 'The origin server did not find a current representation for the target resource or is not willing to disclose that one exists. A 404 status code does not indicate whether this lack of representation is temporary or permanent; the 410 Gone status code is preferred if the origin server knows that the condition is likely permanent.' },
    { code: 405, name: 'Method Not Allowed', category: '4xx', description: 'The request method is not supported for the requested resource.', useCase: 'Sending a DELETE request to an endpoint that only supports GET, or POST to a read-only resource.', detail: 'The method received in the request-line is known by the origin server but not supported by the target resource. The origin server MUST generate an Allow header field in a 405 response containing a list of the target resource\'s currently supported methods.' },
    { code: 406, name: 'Not Acceptable', category: '4xx', description: 'The resource cannot generate content acceptable according to the Accept headers.', useCase: 'Client requests application/xml but the API only supports application/json.', detail: 'The target resource does not have a current representation that would be acceptable to the user agent, according to the proactive negotiation header fields received in the request, and the server is unwilling to supply a default representation.' },
    { code: 407, name: 'Proxy Authentication Required', category: '4xx', description: 'The client must first authenticate with the proxy.', useCase: 'Corporate networks requiring proxy authentication before allowing internet access.', detail: 'Similar to 401 Unauthorized, but it indicates that the client needs to authenticate itself in order to use a proxy. The proxy MUST send a Proxy-Authenticate header field containing a challenge applicable to the proxy for the requested resource.' },
    { code: 408, name: 'Request Timeout', category: '4xx', description: 'The server timed out waiting for the request from the client.', useCase: 'Slow network connections where the client takes too long to send the complete request.', detail: 'The server did not receive a complete request message within the time that it was prepared to wait. A client MAY repeat the request without modifications at any later time. This status code is generated by servers, not proxies.' },
    { code: 409, name: 'Conflict', category: '4xx', description: 'The request conflicts with the current state of the target resource.', useCase: 'Concurrent edits to the same resource, or creating a resource that already exists.', detail: 'The request could not be completed due to a conflict with the current state of the target resource. This code is used in situations where the user might be able to resolve the conflict and resubmit the request. The server SHOULD generate a payload that includes enough information for a user to recognize the source of the conflict.' },
    { code: 410, name: 'Gone', category: '4xx', description: 'The resource is no longer available and no forwarding address is known.', useCase: 'Permanently deleted content, deprecated API endpoints, or expired promotional pages.', detail: 'The target resource is no longer available at the origin server and this condition is likely to be permanent. If the origin server does not know, or has no facility to determine, whether or not the condition is permanent, the 404 Not Found status code should be used instead.' },
    { code: 411, name: 'Length Required', category: '4xx', description: 'The server refuses to accept the request without a Content-Length header.', useCase: 'Servers requiring explicit content length for upload operations to allocate resources.', detail: 'The server refuses to accept the request without a defined Content-Length. The client MAY repeat the request if it adds a valid Content-Length header field containing the length of the message body in the request message.' },
    { code: 412, name: 'Precondition Failed', category: '4xx', description: 'One or more conditions in the request header fields evaluated to false.', useCase: 'Optimistic concurrency — If-Match header with an outdated ETag prevents overwriting newer data.', detail: 'One or more conditions given in the request header fields evaluated to false when tested on the server. This response code allows the client to place preconditions on the current resource state and thus prevent the request method from being applied if the target resource is in an unexpected state.' },
    { code: 413, name: 'Payload Too Large', category: '4xx', description: 'The request payload is larger than the server is willing or able to process.', useCase: 'File uploads exceeding the server\'s maximum upload size limit.', detail: 'The server is refusing to process a request because the request payload is larger than the server is willing or able to process. The server MAY close the connection to prevent the client from continuing the request. If the condition is temporary, the server SHOULD generate a Retry-After header field.' },
    { code: 414, name: 'URI Too Long', category: '4xx', description: 'The URI provided was too long for the server to process.', useCase: 'Extremely long query strings, often from improperly using GET for data that should be POST.', detail: 'The server is refusing to service the request because the request-target is longer than the server is willing to interpret. This rare condition is only likely to occur when a client has improperly converted a POST request to a GET request with long query information.' },
    { code: 415, name: 'Unsupported Media Type', category: '4xx', description: 'The media type of the request data is not supported by the server.', useCase: 'Sending form-urlencoded data to an endpoint that only accepts JSON.', detail: 'The origin server is refusing to service the request because the payload is in a format not supported by this method on the target resource. The format problem might be due to the request\'s indicated Content-Type or Content-Encoding, or as a result of inspecting the data directly.' },
    { code: 416, name: 'Range Not Satisfiable', category: '4xx', description: 'The range specified in the Range header cannot be fulfilled.', useCase: 'Requesting byte range 500-1000 of a file that is only 200 bytes long.', detail: 'None of the ranges in the request\'s Range header field overlap the current extent of the selected resource or the set of ranges requested has been rejected due to invalid ranges or an excessive request of small or overlapping ranges.' },
    { code: 417, name: 'Expectation Failed', category: '4xx', description: 'The server cannot meet the requirements of the Expect header field.', useCase: 'Server cannot satisfy the Expect: 100-continue header, often in proxy configurations.', detail: 'The expectation given in the request\'s Expect header field could not be met by at least one of the inbound servers. A server that receives an Expect field-value other than 100-continue MAY respond with a 417 status code.' },
    { code: 418, name: "I'm a Teapot", category: '4xx', description: 'The server refuses to brew coffee because it is, permanently, a teapot.', useCase: 'A humorous status code from RFC 2324 (Hyper Text Coffee Pot Control Protocol). Used as an Easter egg.', detail: 'Any attempt to brew coffee with a teapot should result in the error code "418 I\'m a teapot". The resulting entity body MAY be short and stout. This status code was defined in 1998 as an April Fools\' joke in RFC 2324, Hyper Text Coffee Pot Control Protocol (HTCPCP/1.0). It is not expected to be implemented by actual HTTP servers, but its use as an Easter egg is widespread.' },
    { code: 421, name: 'Misdirected Request', category: '4xx', description: 'The request was directed at a server that is not able to produce a response.', useCase: 'HTTP/2 connection coalescing — request sent to a server that doesn\'t handle the target domain.', detail: 'The request was directed at a server that is not able to produce a response. This can be sent by a server that is not configured to produce responses for the combination of scheme and authority that are included in the request URI.' },
    { code: 422, name: 'Unprocessable Entity', category: '4xx', description: 'The request was well-formed but semantically incorrect.', useCase: 'Form validation errors — correct JSON syntax but invalid field values (e.g., negative age, invalid email).', detail: 'The server understands the content type of the request entity, and the syntax of the request entity is correct, but it was unable to process the contained instructions. For example, this error condition may occur if an XML request body contains well-formed but semantically erroneous XML instructions.' },
    { code: 423, name: 'Locked', category: '4xx', description: 'The source or destination resource of a method is locked.', useCase: 'WebDAV — attempting to modify a file that another user has locked for editing.', detail: 'The source or destination resource of a method is locked. This response SHOULD contain an appropriate precondition or postcondition code, such as "lock-token-submitted" or "no-conflicting-lock". A WebDAV-specific status code.' },
    { code: 424, name: 'Failed Dependency', category: '4xx', description: 'The method could not be performed because of a failure of a previous request.', useCase: 'WebDAV batch operations where one sub-operation fails, causing dependent operations to also fail.', detail: 'The method could not be performed on the resource because the requested action depended on another action and that action failed. For example, if a command in a PROPPATCH method fails, then at minimum the rest of the commands will also fail with 424 Failed Dependency.' },
    { code: 425, name: 'Too Early', category: '4xx', description: 'The server is unwilling to process a request that might be replayed.', useCase: 'TLS 1.3 0-RTT early data — server rejects requests that could be replay attacks.', detail: 'Indicates that the server is unwilling to risk processing a request that might be replayed. This status code is defined to mitigate the risks associated with TLS 1.3 0-RTT (early data) where a request could potentially be replayed by an attacker.' },
    { code: 426, name: 'Upgrade Required', category: '4xx', description: 'The server refuses to perform the request using the current protocol.', useCase: 'Server requiring TLS — responds with 426 to HTTP requests that must use HTTPS.', detail: 'The server refuses to perform the request using the current protocol but might be willing to do so after the client upgrades to a different protocol. The server MUST send an Upgrade header field in a 426 response to indicate the required protocol(s).' },
    { code: 428, name: 'Precondition Required', category: '4xx', description: 'The origin server requires the request to be conditional.', useCase: 'APIs requiring If-Match headers to prevent lost updates in concurrent editing scenarios.', detail: 'The origin server requires the request to be conditional. This response is intended to prevent the "lost update" problem, where a client GETs a resource\'s state, modifies it, and PUTs it back to the server, when meanwhile a third party has modified the state on the server, leading to a conflict.' },
    { code: 429, name: 'Too Many Requests', category: '4xx', description: 'The user has sent too many requests in a given amount of time.', useCase: 'API rate limiting — client exceeded the allowed number of requests per minute/hour.', detail: 'The user has sent too many requests in a given amount of time ("rate limiting"). The response representations SHOULD include a Retry-After header indicating how long to wait before making a new request. When a server is under attack or just receiving a very large number of requests from a single party, responding to each with a 429 status code will consume resources.' },
    { code: 431, name: 'Request Header Fields Too Large', category: '4xx', description: 'The server is unwilling to process the request because its header fields are too large.', useCase: 'Oversized cookies or excessively long authorization tokens.', detail: 'The server is unwilling to process the request because its header fields are too large. The request MAY be resubmitted after reducing the size of the request header fields. It can be used both when the set of request header fields in total is too large, and when a single header field is too large.' },
    { code: 451, name: 'Unavailable For Legal Reasons', category: '4xx', description: 'The resource is unavailable due to legal demands.', useCase: 'Content blocked by government censorship, DMCA takedowns, or GDPR compliance.', detail: 'The server is denying access to the resource as a consequence of a legal demand. The server in question might not be an origin server. This type of legal demand typically most directly affects the operations of ISPs and search engines. Named after Ray Bradbury\'s dystopian novel Fahrenheit 451.' },

    // 5xx Server Error
    { code: 500, name: 'Internal Server Error', category: '5xx', description: 'The server encountered an unexpected condition that prevented it from fulfilling the request.', useCase: 'Unhandled exceptions, null pointer errors, or misconfigured server-side code.', detail: 'The server encountered an unexpected condition that prevented it from fulfilling the request. This is a generic "catch-all" response when the server-side code throws an exception or otherwise fails in an unanticipated way. It does not reveal specifics about the error to the client.' },
    { code: 501, name: 'Not Implemented', category: '5xx', description: 'The server does not support the functionality required to fulfill the request.', useCase: 'Server receiving an HTTP method it doesn\'t recognize (e.g., PATCH on an older server).', detail: 'The server does not support the functionality required to fulfill the request. This is the appropriate response when the server does not recognize the request method and is not capable of supporting it for any resource. A 501 response is cacheable by default.' },
    { code: 502, name: 'Bad Gateway', category: '5xx', description: 'The server received an invalid response from an upstream server.', useCase: 'Reverse proxy (Nginx/CloudFlare) cannot reach the application server behind it.', detail: 'The server, while acting as a gateway or proxy, received an invalid response from an inbound server it accessed while attempting to fulfill the request. This typically occurs when a reverse proxy or load balancer cannot communicate with the upstream application server.' },
    { code: 503, name: 'Service Unavailable', category: '5xx', description: 'The server is not ready to handle the request, usually due to maintenance or overload.', useCase: 'Planned maintenance windows, server overload, or deployment in progress.', detail: 'The server is currently unable to handle the request due to a temporary overloading or maintenance of the server. The implication is that this is a temporary condition which will be alleviated after some delay. If known, the length of the delay MAY be indicated in a Retry-After header.' },
    { code: 504, name: 'Gateway Timeout', category: '5xx', description: 'The server, acting as a gateway, did not receive a timely response from the upstream server.', useCase: 'Backend API taking too long to respond, causing the reverse proxy to time out.', detail: 'The server, while acting as a gateway or proxy, did not receive a timely response from an upstream server it needed to access in order to complete the request. This is different from 408 in that it is the gateway/proxy that timed out, not the client.' },
    { code: 505, name: 'HTTP Version Not Supported', category: '5xx', description: 'The server does not support the HTTP version used in the request.', useCase: 'Client using HTTP/3 against a server that only supports HTTP/1.1.', detail: 'The server does not support, or refuses to support, the major version of HTTP that was used in the request message. The server is indicating that it is unable or unwilling to complete the request using the same major version as the client. The server SHOULD generate a representation for the 505 response describing why that version is not supported.' },
    { code: 506, name: 'Variant Also Negotiates', category: '5xx', description: 'The server has an internal configuration error in transparent content negotiation.', useCase: 'Misconfigured content negotiation resulting in a circular reference.', detail: 'The server has an internal configuration error: the chosen variant resource is configured to engage in transparent content negotiation itself, and is therefore not a proper end point in the negotiation process. This status code is rarely seen in practice.' },
    { code: 507, name: 'Insufficient Storage', category: '5xx', description: 'The server cannot store the representation needed to complete the request.', useCase: 'WebDAV server running out of disk space while processing a file upload or copy operation.', detail: 'The method could not be performed on the resource because the server is unable to store the representation needed to successfully complete the request. This condition is considered to be temporary. A WebDAV-specific status code.' },
    { code: 508, name: 'Loop Detected', category: '5xx', description: 'The server detected an infinite loop while processing the request.', useCase: 'WebDAV — circular references in resource bindings causing infinite processing loops.', detail: 'The server terminated an operation because it encountered an infinite loop while processing a request with "Depth: infinity". This status indicates that the entire operation failed. A WebDAV-specific status code.' },
    { code: 510, name: 'Not Extended', category: '5xx', description: 'Further extensions to the request are required for the server to fulfill it.', useCase: 'The server requires additional HTTP extensions not present in the request.', detail: 'The policy for accessing the resource has not been met in the request. The server should send back all the information necessary for the client to issue an extended request. This status code is rarely encountered in practice.' },
    { code: 511, name: 'Network Authentication Required', category: '5xx', description: 'The client needs to authenticate to gain network access.', useCase: 'Captive portals — WiFi hotspots that require login before granting internet access.', detail: 'The 511 status code indicates that the client needs to authenticate to gain network access. This status code is NOT generated by origin servers but by intercepting proxies (captive portals) that are used to control access to the network. The response should contain a link to a resource allowing the user to submit credentials.' },
  ];

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Filtering ───────────────────────────────────────────────────────────────

  get filteredCodes(): HttpStatusEntry[] {
    let results = this.statusCodes;

    if (this.activeCategory !== 'all') {
      results = results.filter(s => s.category === this.activeCategory);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      results = results.filter(s =>
        s.code.toString().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }

    return results;
  }

  get resultCount(): number {
    return this.filteredCodes.length;
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  onSearchInput() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.checkEasterEgg();
    }, 300);
  }

  private checkEasterEgg() {
    const q = this.searchQuery.trim();
    if (q === '418') {
      this.eggs.trigger('http-teapot-ref');
    }
  }

  setCategory(cat: StatusCategory) {
    this.activeCategory = cat;
  }

  // ── Detail view ─────────────────────────────────────────────────────────────

  selectStatus(entry: HttpStatusEntry) {
    this.selectedStatus = this.selectedStatus?.code === entry.code ? null : entry;
  }

  closeDetail() {
    this.selectedStatus = null;
  }

  // ── Copy ────────────────────────────────────────────────────────────────────

  async copyStatus(entry: HttpStatusEntry) {
    if (!this.isBrowser) return;
    const text = `${entry.code} ${entry.name} — ${entry.description}`;
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  getCategoryColor(category: string): string {
    switch (category) {
      case '1xx': return '#60a5fa';
      case '2xx': return '#34d399';
      case '3xx': return '#fbbf24';
      case '4xx': return '#fb923c';
      case '5xx': return '#f87171';
      default:    return 'var(--text-muted)';
    }
  }

  getCategoryLabel(category: string): string {
    switch (category) {
      case '1xx': return 'Informational';
      case '2xx': return 'Success';
      case '3xx': return 'Redirection';
      case '4xx': return 'Client Error';
      case '5xx': return 'Server Error';
      default:    return '';
    }
  }
}
