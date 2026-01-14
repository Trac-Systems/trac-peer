import {
  handleHealth,
  handleStatus,
  handleGetState,
  handleBroadcastTx,
  handleDeploySubnet,
  handleSetChatStatus,
  handlePostChatMessage,
  handleSetNick,
  handleAddAdmin,
  handleAddWriter,
  handleAddIndexer,
  handleRemoveWriter,
  handleRemoveIndexer,
  handleJoinValidator,
} from "../handlers.js";

export const v1Routes = [
  { method: "GET", path: "/health", handler: handleHealth },
  { method: "GET", path: "/status", handler: handleStatus },
  { method: "GET", path: "/state", handler: handleGetState },

  { method: "POST", path: "/tx", handler: handleBroadcastTx },
  { method: "POST", path: "/deploy-subnet", handler: handleDeploySubnet },

  { method: "POST", path: "/chat/status", handler: handleSetChatStatus },
  { method: "POST", path: "/chat/post", handler: handlePostChatMessage },
  { method: "POST", path: "/chat/nick", handler: handleSetNick },

  { method: "POST", path: "/admin/add-admin", handler: handleAddAdmin },
  { method: "POST", path: "/admin/add-writer", handler: handleAddWriter },
  { method: "POST", path: "/admin/add-indexer", handler: handleAddIndexer },
  { method: "POST", path: "/admin/remove-writer", handler: handleRemoveWriter },
  { method: "POST", path: "/admin/remove-indexer", handler: handleRemoveIndexer },

  { method: "POST", path: "/msb/join-validator", handler: handleJoinValidator },
];
