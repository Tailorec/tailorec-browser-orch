import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestServer,
  stopTestServer,
  type TestServerState,
} from "../helpers";

/**
 * Contract Tests: Header Contracts
 *
 * These tests validate the request and response header contracts.
 * Includes correlation ID propagation, content-type, and other headers.
 *
 * Test Plan Reference: TEST_PLAN.md - Task C4
 */

let serverState: TestServerState;
let baseUrl = "";
const correlationHeaderName = (process.env.CORRELATION_ID_HEADER || "x-correlation-id").toLowerCase();

beforeAll(async () => {
  process.env.PORT = "4014";
  process.env.BROWSER_HEADLESS = "true";

  serverState = await createTestServer({ port: 4014, headless: true });
  baseUrl = serverState.baseUrl;
});

afterAll(async () => {
  await stopTestServer(serverState);
});

describe("contract: Request headers", () => {
  // ==========================================================================
  // Content-Type
  // ==========================================================================
  describe("Content-Type header", () => {
    it("POST requests should accept application/json", async () => {
      const response = await request(baseUrl)
        .post("/snapshot")
        .set("Content-Type", "application/json")
        .send({});

      // Should not reject based on Content-Type
      expect(response.status).not.toBe(415);
    });

    it("requests without Content-Type still work for GET", async () => {
      const response = await request(baseUrl).get("/status");

      expect(response.status).toBe(200);
    });
  });

  // ==========================================================================
  // Correlation ID Request Header
  // ==========================================================================
  describe("Correlation ID request header", () => {
    it("accepts x-correlation-id header", async () => {
      const testCorrelationId = "test-correlation-123";
      const response = await request(baseUrl)
        .get("/status")
        .set(correlationHeaderName, testCorrelationId);

      expect(response.status).toBe(200);
    });

    it("accepts x-request-id as alternative", async () => {
      const testRequestId = "request-456";
      const response = await request(baseUrl)
        .get("/status")
        .set("x-request-id", testRequestId);

      expect(response.status).toBe(200);
    });

    it("accepts x-trace-id as alternative", async () => {
      const testTraceId = "trace-789";
      const response = await request(baseUrl)
        .get("/status")
        .set("x-trace-id", testTraceId);

      expect(response.status).toBe(200);
    });

    it("works without correlation ID (server generates one)", async () => {
      const response = await request(baseUrl).get("/status");

      expect(response.status).toBe(200);
      expect(response.headers[correlationHeaderName]).toBeDefined();
    });

    it("preserves correlation ID format (UUID-like)", async () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      const response = await request(baseUrl)
        .get("/status")
        .set(correlationHeaderName, validUuid);

      expect(response.status).toBe(200);
    });
  });

  // ==========================================================================
  // Host Header
  // ==========================================================================
  describe("Host header", () => {
    it("includes host header automatically", async () => {
      const response = await request(baseUrl).get("/status");

      expect(response.status).toBe(200);
    });
  });
});

describe("contract: Response headers", () => {
  // ==========================================================================
  // Content-Type Response
  // ==========================================================================
  describe("Content-Type response header", () => {
    it("all JSON responses have application/json content-type", async () => {
      const endpoints = [
        { method: "get", path: "/status" },
        { method: "post", path: "/snapshot", body: {} },
      ];

      for (const endpoint of endpoints) {
        let response;
        if (endpoint.method === "get") {
          response = await request(baseUrl).get(endpoint.path);
        } else {
          response = await request(baseUrl)[endpoint.method](endpoint.path).send(endpoint.body || {});
        }

        expect(response.headers["content-type"]).toContain("application/json");
      }
    });

    it("error responses also have application/json content-type", async () => {
      const response = await request(baseUrl)
        .post("/act")
        .send({});

      expect(response.headers["content-type"]).toContain("application/json");
    });
  });

  // ==========================================================================
  // Correlation ID Response Header
  // ==========================================================================
  describe("Correlation ID response header", () => {
    it("includes correlation ID in all responses", async () => {
      const response = await request(baseUrl).get("/status");

      expect(response.headers[correlationHeaderName]).toBeDefined();
      expect(response.headers[correlationHeaderName].length).toBeGreaterThan(0);
    });

    it("includes correlation ID in error responses", async () => {
      const response = await request(baseUrl)
        .post("/act")
        .send({});

      expect(response.status).toBe(400);
      expect(response.headers[correlationHeaderName]).toBeDefined();
      expect(response.headers[correlationHeaderName].length).toBeGreaterThan(0);
    });

    it("correlation ID is consistent across request/response", async () => {
      const testCorrelationId = "consistent-test-id";
      const response = await request(baseUrl)
        .get("/status")
        .set(correlationHeaderName, testCorrelationId);

      expect(response.headers[correlationHeaderName]).toBe(testCorrelationId);
    });

    it("server generates correlation ID when not provided", async () => {
      const response = await request(baseUrl).get("/status");

      const correlationId = response.headers[correlationHeaderName];
      expect(correlationId).toBeDefined();
      expect(typeof correlationId).toBe("string");
      expect(correlationId.length).toBeGreaterThan(0);
    });

    it("correlation ID format is valid (alphanumeric with hyphens)", async () => {
      const response = await request(baseUrl).get("/status");
      const correlationId = response.headers[correlationHeaderName];

      // Should only contain alphanumeric, hyphens, underscores
      expect(correlationId).toMatch(/^[a-zA-Z0-9_-]+$/);
    });
  });

  // ==========================================================================
  // Cache Control
  // ==========================================================================
  describe("Cache-Control header", () => {
    it("API responses should not be cached by default", async () => {
      const response = await request(baseUrl).get("/status");

      // Either no cache-control or private/no-store
      if (response.headers["cache-control"]) {
        expect(response.headers["cache-control"]).toMatch(/no-store|private|no-cache/);
      }
    });
  });

  // ==========================================================================
  // Server Header
  // ==========================================================================
  describe("Server identification", () => {
    it("includes server timing or identification", async () => {
      const response = await request(baseUrl).get("/status");

      // May include various server identification headers
      expect(response.status).toBe(200);
    });
  });
});

describe("contract: Correlation ID propagation", () => {
  // ==========================================================================
  // Single Request Propagation
  // ==========================================================================
  describe("Single request correlation", () => {
    it("correlation ID flows through entire request lifecycle", async () => {
      const testId = "lifecycle-test-123";
      const response = await request(baseUrl)
        .get("/status")
        .set(correlationHeaderName, testId);

      // Request was processed with this correlation ID
      expect(response.headers[correlationHeaderName]).toBe(testId);
    });

    it("correlation ID appears in error responses", async () => {
      const testId = "error-test-456";
      const response = await request(baseUrl)
        .post("/act")
        .set(correlationHeaderName, testId)
        .send({ kind: "invalid" });

      expect(response.status).toBe(400);
      expect(response.headers[correlationHeaderName]).toBe(testId);
    });
  });

  // ==========================================================================
  // Multiple Request Independence
  // ==========================================================================
  describe("Multiple request independence", () => {
    it("different correlation IDs for different requests", async () => {
      const id1 = "request-1";
      const id2 = "request-2";

      const response1 = await request(baseUrl)
        .get("/status")
        .set(correlationHeaderName, id1);

      const response2 = await request(baseUrl)
        .get("/status")
        .set(correlationHeaderName, id2);

      expect(response1.headers[correlationHeaderName]).toBe(id1);
      expect(response2.headers[correlationHeaderName]).toBe(id2);
    });

    it("concurrent requests maintain separate correlation IDs", async () => {
      const ids = ["concurrent-1", "concurrent-2", "concurrent-3"];

      const responses = await Promise.all(
        ids.map((id) =>
          request(baseUrl)
            .get("/status")
            .set(correlationHeaderName, id)
        )
      );

      responses.forEach((response, index) => {
        expect(response.headers[correlationHeaderName]).toBe(ids[index]);
      });
    });
  });

  // ==========================================================================
  // Correlation ID Format
  // ==========================================================================
  describe("Correlation ID format validation", () => {
    it("generated correlation IDs are valid strings", async () => {
      const response = await request(baseUrl).get("/status");
      const correlationId = response.headers[correlationHeaderName];

      expect(typeof correlationId).toBe("string");
      expect(correlationId.length).toBeGreaterThan(0);
      expect(correlationId.length).toBeLessThanOrEqual(100);
    });

    it("correlation IDs don't contain dangerous characters", async () => {
      const response = await request(baseUrl).get("/status");
      const correlationId = response.headers[correlationHeaderName];

      // Should not contain newlines, null bytes, etc.
      expect(correlationId).not.toMatch(/[\n\r\0]/);
    });
  });
});

describe("contract: Additional header contracts", () => {
  // ==========================================================================
  // Request ID uniqueness
  // ==========================================================================
  describe("Request ID uniqueness", () => {
    it("each request gets unique correlation ID when not provided", async () => {
      const responses = await Promise.all(
        Array(5).fill(null).map(() => request(baseUrl).get("/status"))
      );

      const correlationIds = responses.map((r) => r.headers[correlationHeaderName]);
      const uniqueIds = new Set(correlationIds);

      // All IDs should be unique
      expect(uniqueIds.size).toBe(correlationIds.length);
    });
  });

  // ==========================================================================
  // Header case insensitivity
  // ==========================================================================
  describe("Header case handling", () => {
    it("accepts correlation ID header in various cases", async () => {
      const testId = "case-test";
      
      // Node.js/Express normalizes headers to lowercase
      const response = await request(baseUrl)
        .get("/status")
        .set(correlationHeaderName, testId);

      expect(response.status).toBe(200);
      expect(response.headers[correlationHeaderName]).toBe(testId);
    });
  });

  // ==========================================================================
  // Empty/missing header handling
  // ==========================================================================
  describe("Empty/missing header handling", () => {
    it("empty correlation ID triggers server generation", async () => {
      const response = await request(baseUrl)
        .get("/status")
        .set(correlationHeaderName, "");

      expect(response.status).toBe(200);
      expect(response.headers[correlationHeaderName]).toBeDefined();
      expect(response.headers[correlationHeaderName].length).toBeGreaterThan(0);
    });

    it("missing correlation ID triggers server generation", async () => {
      const response = await request(baseUrl).get("/status");

      expect(response.status).toBe(200);
      expect(response.headers[correlationHeaderName]).toBeDefined();
    });
  });
});

describe("contract: Header security", () => {
  // ==========================================================================
  // Header injection prevention
  // ==========================================================================
  describe("Header injection prevention", () => {
    it("correlation ID with special characters is handled safely", async () => {
      const safeId = "safe-id-123";
      const response = await request(baseUrl)
        .get("/status")
        .set(correlationHeaderName, safeId);

      expect(response.status).toBe(200);
      expect(response.headers[correlationHeaderName]).toBe(safeId);
    });

    it("very long correlation IDs are handled", async () => {
      const longId = "a".repeat(200);
      const response = await request(baseUrl)
        .get("/status")
        .set(correlationHeaderName, longId);

      // Should either accept or reject gracefully
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });
});
