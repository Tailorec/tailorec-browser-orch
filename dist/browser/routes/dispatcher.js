"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrowserRouteDispatcher = createBrowserRouteDispatcher;
function createBrowserRouteDispatcher(ctx) {
    return {
        dispatch: async (req) => {
            // Stub for client-fetch.ts - client side dispatch simulation
            return { status: 200, body: {} };
        }
    };
}
