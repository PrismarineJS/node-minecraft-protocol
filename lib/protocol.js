var assert = require('assert');
var util = require('util');

var STRING_MAX_LENGTH = 240;
var SRV_STRING_MAX_LENGTH = 32767;

// This is really just for the client.
var states = {
  "HANDSHAKING": "handshaking",
  "STATUS": "status",
  "LOGIN": "login",
  "PLAY": "play"
}

var packets = {
  handshaking: {
    toClient: {},
    toServer: { 
      set_protocol:          {id: 0x00, fields: [
        { name: "protocolVersion", type: "varint" },
        { name: "serverHost", type: "string" },
        { name: "serverPort", type: "ushort" },
        { name: "nextState", type: "varint" }
      ]}
    },
  },

// TODO : protocollib names aren't the best around here
  status: {
    toClient: {
      server_info:    {id: 0x00, fields: [
        { name: "response", type: "ustring" }
      ]},
      ping:        {id: 0x01, fields: [
        { name: "time", type: "long" }
      ]}
    },
    toServer: {
      ping_start:     {id: 0x00, fields: []},
      ping:        {id: 0x01, fields: [
        { name: "time", type: "long" }
      ]}
    }
  },

  login: {
    toClient: {
      disconnect:   {id: 0x00, fields: [
        { name: "reason", type: "string" }
      ]},
      encryption_begin: {id: 0x01, fields: [
        { name: "serverId", type: "string" },
        { name: "publicKeyLength", type: "count", typeArgs: { type: "short", countFor: "publicKey" } },
        { name: "publicKey", type: "buffer", typeArgs: { count: "publicKeyLength" } },
        { name: "verifyTokenLength", type: "count", typeArgs: { type: "short", countFor: "verifyToken" } },
        { name: "verifyToken", type: "buffer", typeArgs: { count: "verifyTokenLength" } },
      ]},
      success:      {id: 0x02, fields: [
        { name: "uuid", type: "string" },
        { name: "username", type: "string" }
      ]}
    },
    toServer: {
      login_start:        {id: 0x00, fields: [
        { name: "username", type: "string" }
      ]},
      encryption_begin: {id: 0x01, fields: [
        { name: "sharedSecretLength", type: "count", typeArgs: { type: "short", countFor: "sharedSecret" } },
        { name: "sharedSecret", type: "buffer", typeArgs: { count: "sharedSecretLength" } },
        { name: "verifyTokenLength", type: "count", typeArgs: { type: "short", countFor: "verifyToken" } },
        { name: "verifyToken", type: "buffer", typeArgs: { count: "verifyTokenLength" } },
      ]}
    }
  },

  play: {
    toClient: {
      keep_alive:         {id: 0x00, fields: [
        { name: "keepAliveId", type: "int" },
      ]},
      login:          {id: 0x01, fields: [
        { name: "entityId", type: "int" },
        { name: "gameMode", type: "ubyte" },
        { name: "dimension", type: "byte" },
        { name: "difficulty", type: "ubyte" },
        { name: "maxPlayers", type: "ubyte" },
        { name: "levelType", type: "string" },
      ]},
      chat:               {id: 0x02, fields: [
        { name: "message", type: "ustring" },
      ]},
      update_time:        {id: 0x03, fields: [
        { name: "age", type: "long" },
        { name: "time", type: "long" },
      ]},
      entity_equipment:   {id: 0x04, fields: [
        { name: "entityId", type: "int" },
        { name: "slot", type: "short" },
        { name: "item", type: "slot" }
      ]},
      spawn_position:     {id: 0x05, fields: [
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" }
      ]},
      update_health:      {id: 0x06, fields: [
        { name: "health", type: "float" },
        { name: "food", type: "short" },
        { name: "foodSaturation", type: "float" }
      ]},
      respawn:            {id: 0x07, fields: [
        { name: "dimension", type: "int" },
        { name: "difficulty", type: "ubyte" },
        { name: "gamemode", type: "ubyte" },
        { name: "levelType", type: "string" }
      ]},
      position:    {id: 0x08, fields: [
        { name: "x", type: "double" },
        { name: "y", type: "double" },
        { name: "z", type: "double" },
        { name: "yaw", type: "float" },
        { name: "pitch", type: "float" },
        { name: "onGround", type: "bool" }
      ]},
      held_item_slot:   {id: 0x09, fields: [
        { name: "slot", type: "byte" }
      ]},
      bed:            {id: 0x0a, fields: [
        { name: "entityId", type: "int" },
        { name: "x", type: "int" },
        { name: "y", type: "ubyte" },
        { name: "z", type: "int" }
      ]},
      animation:          {id: 0x0b, fields: [
        { name: "entityId", type: "varint" },
        { name: "animation", type: "byte" }
      ]},
      named_entity_spawn:       {id: 0x0c, fields: [
        { name: "entityId", type: "varint" },
        { name: "playerUUID", type: "string" },
        { name: "playerName", type: "string" },
        { name: "dataCount", type: "count", typeArgs: { type: "varint", countFor: "data" }},
        { name: "data", type: "array", typeArgs: { count: "dataCount", 
          type: "container", typeArgs: { fields: [
            { name: "name", type: "string" },
            { name: "value", type: "string" },
            { name: "signature", type: "string" }
        ]}}},
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "yaw", type: "byte" },
        { name: "pitch", type: "byte" },
        { name: "currentItem", type: "short" },
        { name: "metadata", type: "entityMetadata" }
      ]},
      collect:       {id: 0x0d, fields: [
        { name: "collectedEntityId", type: "int" },
        { name: "collectorEntityId", type: "int" }
      ]},
      spawn_entity:       {id: 0x0e, fields: [
        { name: "entityId", type: "varint" },
        { name: "type", type: "byte" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "pitch", type: "byte" },
        { name: "yaw", type: "byte" },
        { name: "objectData", type: "container", typeArgs: { fields: [
          { name: "intField", type: "int" },
          { name: "velocityX", type: "short", condition: function(field_values) {
            return field_values['this']['intField'] != 0;
          }},
          { name: "velocityY", type: "short", condition: function(field_values) {
            return field_values['this']['intField'] != 0;
          }},
          { name: "velocityZ", type: "short", condition: function(field_values) {
            return field_values['this']['intField'] != 0;
          }}
        ]}} 
      ]},
      spawn_entity_living:          {id: 0x0f, fields: [
        { name: "entityId", type: "varint" },
        { name: "type", type: "ubyte" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "pitch", type: "byte" },
        { name: "headPitch", type: "byte" },
        { name: "yaw", type: "byte" },
        { name: "velocityX", type: "short" },
        { name: "velocityY", type: "short" },
        { name: "velocityZ", type: "short" },
        { name: "metadata", type: "entityMetadata" },
      ]},
      spawn_entity_painting:     {id: 0x10, fields: [
        { name: "entityId", type: "varint" },
        { name: "title", type: "string" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "direction", type: "int" }
      ]},
      spawn_entity_experience_orb: {id: 0x11, fields: [
        { name: "entityId", type: "varint" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "count", type: "short" }
      ]},
      entity_velocity:    {id: 0x12, fields: [
        { name: "entityId", type: "int" },
        { name: "velocityX", type: "short" },
        { name: "velocityY", type: "short" },
        { name: "velocityZ", type: "short" }
      ]},
      entity_destroy:   {id: 0x13, fields: [
        { name: "count", type: "count", typeArgs: { type: "byte", countFor: "entityIds" } },
        { name: "entityIds", type: "array", typeArgs: { type: "int", count: "count" } }
      ]},
      entity:             {id: 0x14, fields: [
        { name: "entityId", type: "int" } 
      ]},
      rel_entity_move: {id: 0x15, fields: [
        { name: "entityId", type: "int" },
        { name: "dX", type: "byte" },
        { name: "dY", type: "byte" },
        { name: "dZ", type: "byte" }
      ]},
      entity_look:        {id: 0x16, fields: [
        { name: "entityId", type: "int" },
        { name: "yaw", type: "byte" },
        { name: "pitch", type: "byte" }
      ]},
      entity_move_look: {id: 0x17, fields: [
        { name: "entityId", type: "int" },
        { name: "dX", type: "byte" },
        { name: "dY", type: "byte" },
        { name: "dZ", type: "byte" },
        { name: "yaw", type: "byte" },
        { name: "pitch", type: "byte" }
      ]},
      entity_teleport:    {id: 0x18, fields: [
        { name: "entityId", type: "int" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "yaw", type: "byte" },
        { name: "pitch", type: "byte" }
      ]},
      entity_head_rotation:   {id: 0x19, fields: [
        { name: "entityId", type: "int" },
        { name: "headYaw", type: "byte" },
      ]},
      entity_status:      {id: 0x1a, fields: [
        { name: "entityId", type: "int" },
        { name: "entityStatus", type: "byte" }
      ]},
      attach_entity:      {id: 0x1b, fields: [
        { name: "entityId", type: "int" },
        { name: "vehicleId", type: "int" },
        { name: "leash", type: "bool" }
      ]},
      entity_metadata:    {id: 0x1c, fields: [
        { name: "entityId", type: "int" },
        { name: "metadata", type: "entityMetadata" }
      ]},
      entity_effect:      {id: 0x1d, fields: [
        { name: "entityId", type: "int" },
        { name: "effectId", type: "byte" },
        { name: "amplifier", type: "byte" },
        { name: "duration", type: "short" }
      ]},
      remove_entity_effect: {id: 0x1e, fields: [
        { name: "entityId", type: "int" },
        { name: "effectId", type: "byte" }
      ]},
      experience:     {id: 0x1f, fields: [
        { name: "experienceBar", type: "float" },
        { name: "level", type: "short" },
        { name: "totalExperience", type: "short" }
      ]},
      update_attributes:  {id: 0x20, fields: [
        { name: "entityId", type: "int" },
        { name: "count", type: "count", typeArgs: { type: "int", countFor: "properties" } },
        { name: "properties", type: "array", typeArgs: { count: "count", 
          type: "container", typeArgs: { fields: [
            { name: "key", type: "string" },
            { name: "value", type: "double" },
            { name: "listLength", type: "count", typeArgs: { type: "short", countFor: "this.modifiers" } },
            { name: "modifiers", type: "array", typeArgs: { count: "this.listLength", 
              type: "container", typeArgs: { fields: [
                { name: "UUID", type: "UUID" },
                { name: "amount", type: "double" },
                { name: "operation", type: "byte" }
              ]}}}
          ]}
        }}
      ]},
      map_chunk:         {id: 0x21, fields: [
        { name: "x", type: "int" },
        { name: "z", type: "int" },
        { name: "groundUp", type: "bool" },
        { name: "bitMap", type: "ushort" },
        { name: "addBitMap", type: "ushort" },
        { name: "compressedChunkDataLength", type: "count", typeArgs: { type: "int", countFor: "compressedChunkData" } },
        { name: "compressedChunkData", type: "buffer", typeArgs: { count: "compressedChunkDataLength" } },
      ]},
      multi_block_change: {id: 0x22, fields: [
        { name: "chunkX", type: "int" },
        { name: "chunkZ", type: "int" },
        { name: "recordCount", type: "short" },
        { name: "dataLength", type: "count", typeArgs: { type: "int", countFor: "data" } },
        { name: "data", type: "buffer", typeArgs: { count: "dataLength" } },
      ]},
      block_change:       {id: 0x23, fields: [
        { name: "x", type: "int" },
        { name: "y", type: "ubyte" },
        { name: "z", type: "int" },
        { name: "type", type: "varint" },
        { name: "metadata", type: "ubyte" }
      ]},
      block_action:       {id: 0x24, fields: [
        { name: "x", type: "int" },
        { name: "y", type: "short" },
        { name: "z", type: "int" },
        { name: "byte1", type: "ubyte" },
        { name: "byte2", type: "ubyte" },
        { name: "blockId", type: "varint" }
      ]},
      block_break_animation:   {id: 0x25, fields: [
        { name: "entityId", type: "varint" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "destroyStage", type: "byte" }
      ]},
      map_chunk_bulk:     {id: 0x26, fields: [
        { name: "chunkColumnCount", type: "count", typeArgs: { type: "short", countFor: "meta" } },
        { name: "dataLength", type: "count", typeArgs: { type: "int", countFor: "compressedChunkData" } },
        { name: "skyLightSent", type: "bool" },
        { name: "compressedChunkData", type: "buffer", typeArgs: { count: "dataLength" } },
        { name: "meta", type: "array", typeArgs: { count: "chunkColumnCount", 
          type: "container", typeArgs: { fields: [
            { name: "x", type: "int" },
            { name: "z", type: "int" },
            { name: "bitMap", type: "ushort" },
            { name: "addBitMap", type: "ushort" }
        ] } } }
      ]},
      explosion:          {id: 0x27, fields: [
        { name: "x", type: "float" },
        { name: "y", type: "float" },
        { name: "z", type: "float" },
        { name: "radius", type: "float" },
        { name: "count", type: "count", typeArgs: { type: "int", countFor: "affectedBlockOffsets" } },
        { name: "affectedBlockOffsets", type: "array", typeArgs: { count: "count", type: "container", typeArgs: {
          fields: [
            { name: "x", type: "byte" },
            { name: "y", type: "byte" },
            { name: "z", type: "byte" }
          ]
        }}},
        { name: "playerMotionX", type: "float" },
        { name: "playerMotionY", type: "float" },
        { name: "playerMotionZ", type: "float" }
      ]},
      world_event:             {id: 0x28, fields: [ // TODO : kinda wtf naming there
        { name: "effectId", type: "int" },
        { name: "x", type: "int" },
        { name: "y", type: "byte" },
        { name: "z", type: "int" },
        { name: "data", type: "int" },
        { name: "global", type: "bool" }
      ]},
      named_sound_effect:       {id: 0x29, fields: [
        { name: "soundName", type: "string" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" },
        { name: "volume", type: "float" },
        { name: "pitch", type: "ubyte" }
      ]},
      world_particles:           {id: 0x2a, fields: [
        { name: "particleName", type: "string" },
        { name: "x", type: "float" },
        { name: "y", type: "float" },
        { name: "z", type: "float" },
        { name: "offsetX", type: "float" },
        { name: "offsetY", type: "float" },
        { name: "offsetZ", type: "float" },
        { name: "particleSpeed", type: "float" },
        { name: "particles", type: "int" }
      ]},
      game_state_change:  {id: 0x2b, fields: [
        { name: "reason", type: "ubyte" },
        { name: "gameMode", type: "float" }
      ]},
      spawn_entity_weather:{id: 0x2c, fields: [
        { name: "entityId", type: "varint" },
        { name: "type", type: "byte" },
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" }
      ]},
      open_window:        {id: 0x2d, fields: [
        { name: "windowId", type: "ubyte" },
        { name: "inventoryType", type: "ubyte" },
        { name: "windowTitle", type: "string" },
        { name: "slotCount", type: "ubyte" },
        { name: "useProvidedTitle", type: "bool" },
        { name: "entityId", type: "int", condition: function(field_values) {
          return field_values['inventoryType'] == 11;
        } }
      ]},
      close_window:       {id: 0x2e, fields: [
        { name: "windowId", type: "ubyte" }
      ]},
      set_slot:           {id: 0x2f, fields: [
        { name: "windowId", type: "ubyte" },
        { name: "slot", type: "short" },
        { name: "item", type: "slot" }
      ]},
      window_items:       {id: 0x30, fields: [
        { name: "windowId", type: "ubyte" },
        { name: "count", type: "count", typeArgs: { type: "short", countFor: "items" } },
        { name: "items", type: "array", typeArgs: { type: "slot", count: "count" } }
      ]},
      craft_progress_bar:    {id: 0x31, fields: [
        { name: "windowId", type: "ubyte" },
        { name: "property", type: "short" },
        { name: "value", type: "short" }
      ]},
      transaction:{id: 0x32, fields: [
        { name: "windowId", type: "ubyte" },
        { name: "action", type: "short" },
        { name: "accepted", type: "bool" }
      ]},
      update_sign:        {id: 0x33, fields: [
        { name: "x", type: "int" },
        { name: "y", type: "short" },
        { name: "z", type: "int" },
        { name: "text1", type: "string" },
        { name: "text2", type: "string" },
        { name: "text3", type: "string" },
        { name: "text4", type: "string" }
      ]},
      map:               {id: 0x34, fields: [
        { name: "itemDamage", type: "varint" },
        { name: "dataLength", type: "count", typeArgs: { type: "short", countFor: "data" } },
        { name: "data", type: "buffer", typeArgs: { count: "dataLength" } },
      ]},
      tile_entity_data:{id: 0x35, fields: [
        { name: "x", type: "int" },
        { name: "y", type: "short" },
        { name: "z", type: "int" },
        { name: "action", type: "ubyte" },
        { name: "nbtDataLength", type: "count", typeArgs: { type: "short", countFor: "nbtData" } },
        { name: "nbtData", type: "buffer", typeArgs: { count: "nbtDataLength" } },
      ]},
      open_sign_entity:   {id: 0x36, fields: [
        { name: "x", type: "int" },
        { name: "y", type: "int" },
        { name: "z", type: "int" }
      ]},
      statistics:         {id: 0x37, fields: [
        { name: "count", type: "count", typeArgs: { type: "varint", countFor: "entries" } },
        { name: "entries", type: "array", typeArgs: { count: "count", 
          type: "container", typeArgs: { fields: [
            { name: "name", type: "string" },
            { name: "value", type: "varint" }
          ]}
        }}
      ]},
      player_info:   {id: 0x38, fields: [
        { name: "playerName", type: "string" },
        { name: "online", type: "bool" },
        { name: "ping", type: "short" }
      ]},
      abilities:   {id: 0x39, fields: [
        { name: "flags", type: "byte" },
        { name: "flyingSpeed", type: "float" },
        { name: "walkingSpeed", type: "float" }
      ]},
      tab_complete:       {id: 0x3a, fields: [
        { name: "count", type: "count", typeArgs: { type: "varint", countFor: "matches" } },
        { name: "matches", type: "array", typeArgs: { type: "string", count: "count" } }
      ]},
      scoreboard_objective: {id: 0x3b, fields: [
        { name: "name", type: "string" },
        { name: "displayText", type: "string" },
        { name: "action", type: "byte" }
      ]},
      scoreboard_score:       {id: 0x3c, fields: [
        { name: "itemName", type: "string" },
        { name: "remove", type: "bool" },
        { name: "scoreName", type: "string", condition: function(field_values) {
          return !field_values['remove']
        } },
        { name: "value", type: "int", condition: function(field_values) {
          return !field_values['remove']
        } }
      ]},
      scoreboard_display_objective: {id: 0x3d, fields: [
        { name: "position", type: "byte" },
        { name: "name", type: "string" }
      ]},
      scoreboard_team:              {id: 0x3e, fields: [
        { name: "team", type: "string" },
        { name: "mode", type: "byte" },
        { name: "name", type: "string", condition: function(field_values) {
            return field_values['mode'] == 0 || field_values['mode'] == 2;
        } },
        { name: "prefix", type: "string", condition: function(field_values) {
          return field_values['mode'] == 0 || field_values['mode'] == 2;
        } },
        { name: "suffix", type: "string", condition: function(field_values) {
          return field_values['mode'] == 0 || field_values['mode'] == 2;
        } },
        { name: "friendlyFire", type: "byte", condition: function(field_values) {
          return field_values['mode'] == 0 || field_values['mode'] == 2;
        } },
        { name: "playerCount", type: "count", condition: function(field_values) {
          return field_values['mode'] == 0 || field_values['mode'] == 3 || field_values['mode'] == 4;
        }, typeArgs: { type: "short", countFor: "players" } },
        { name: "players", type: "array", condition: function(field_values) {
          return field_values['mode'] == 0 || field_values['mode'] == 3 || field_values['mode'] == 4;
        }, typeArgs: { type: "string", count: "playerCount" } }
      ]},
      custom_payload:     {id: 0x3f, fields: [
        { name: "channel", type: "string" },
        { name: "dataCount", type: 'count', typeArgs: { type: "short", countFor: "data" } },
        { name: "data", type: "buffer", typeArgs: { count: "dataCount" } }
      ]},
      kick_disconnect:         {id: 0x40, fields: [
        { name: "reason", type: "string" }
      ]}
    },
    toServer: {
      keep_alive:         {id: 0x00, fields: [
        { name: "keepAliveId", type: "int" }
      ]},
      chat:       {id: 0x01, fields: [
        { name: "message", type: "string" }
      ]},
      use_entity:         {id: 0x02, fields: [
        { name: "target", type: "int" },
        { name: "mouse", type: "byte" }
      ]},
      flying:             {id: 0x03, fields: [
        { name: "onGround", type: "bool" }
      ]},
      position:    {id: 0x04, fields: [
        { name: "x", type: "double" },
        { name: "stance", type: "double" },
        { name: "y", type: "double" },
        { name: "z", type: "double" },
        { name: "onGround", type: "bool" }
      ]},
      look:        {id: 0x05, fields: [
        { name: "yaw", type: "float" },
        { name: "pitch", type: "float" },
        { name: "onGround", type: "bool" }
      ]},
      position_look: {id: 0x06, fields: [
        { name: "x", type: "double" },
        { name: "stance", type: "double" },
        { name: "y", type: "double" },
        { name: "z", type: "double" },
        { name: "yaw", type: "float" },
        { name: "pitch", type: "float" },
        { name: "onGround", type: "bool" }
      ]},
      block_dig:     {id: 0x07, fields: [
        { name: "status", type: "byte" },
        { name: "x", type: "int" },
        { name: "y", type: "ubyte" },
        { name: "z", type: "int" },
        { name: "face", type: "byte" }
      ]},
      block_place: {id: 0x08, fields: [
        { name: "x", type: "int" },
        { name: "y", type: "ubyte" },
        { name: "z", type: "int" },
        { name: "direction", type: "byte" },
        { name: "heldItem", type: "slot" },
        { name: "cursorX", type: "byte" },
        { name: "cursorY", type: "byte" },
        { name: "cursorZ", type: "byte" }
      ]},
      held_item_slot:   {id: 0x09, fields: [
        { name: "slotId", type: "short" }
      ]},
      arm_animation:          {id: 0x0a, fields: [
        { name: "entityId", type: "int" },
        { name: "animation", type: "byte" }
      ]},
      entity_action:      {id: 0x0b, fields: [
        { name: "entityId", type: "int" },
        { name: "actionId", type: "byte" },
        { name: "jumpBoost", type: "int" }
      ]},
      steer_vehicle:      {id: 0x0c, fields: [
        { name: "sideways", type: "float" },
        { name: "forward", type: "float" },
        { name: "jump", type: "bool" },
        { name: "unmount", type: "bool" }
      ]},
      close_window:       {id: 0x0d, fields: [
        { name: "windowId", type: "byte" }
      ]},
      window_click:       {id: 0x0e, fields: [
        { name: "windowId", type: "byte" },
        { name: "slot", type: "short" },
        { name: "mouseButton", type: "byte" },
        { name: "action", type: "short" },
        { name: "mode", type: "byte" },
        { name: "item", type: "slot" }
      ]},
      transaction: {id: 0x0f, fields: [
        { name: "windowId", type: "byte" },
        { name: "action", type: "short" },
        { name: "accepted", type: "bool" }
      ]},
      set_creative_slot: {id: 0x10, fields: [
        { name: "slot", type: "short" },
        { name: "item", type: "slot" }
      ]},
      enchant_item:       {id: 0x11, fields: [
        { name: "windowId", type: "byte" },
        { name: "enchantment", type: "byte" }
      ]},
      update_sign:        {id: 0x12, fields: [
        { name: "x", type: "int" },
        { name: "y", type: "short" },
        { name: "z", type: "int" },
        { name: "text1", type: "string" },
        { name: "text2", type: "string" },
        { name: "text3", type: "string" },
        { name: "text4", type: "string" }
      ]},
      abilities:   {id: 0x13, fields: [
        { name: "flags", type: "byte" },
        { name: "flyingSpeed", type: "float" },
        { name: "walkingSpeed", type: "float" }
      ]},
      tab_complete:       {id: 0x14, fields: [
        { name: "text", type: "string" }
      ]},
      settings:    {id: 0x15, fields: [
        { name: "locale", type: "string" },
        { name: "viewDistance", type: "byte" },
        { name: "chatFlags", type: "byte" },
        { name: "chatColors", type: "bool" },
        { name: "difficulty", type: "byte" },
        { name: "showCape", type: "bool" }
      ]},
      client_command:      {id: 0x16, fields: [
        { name: "payload", type: "byte" }
      ]},
      custom_payload:     {id: 0x17, fields: [
        { name: "channel", type: "string" },
        { name: "dataLength", type: "count", typeArgs: { type: "short", countFor: "data" } },
        { name: "data", type: "buffer", typeArgs: { count: "dataLength" } },
      ]}
    }
  }
};

var packetFields = {};
var packetNames = {};
var packetIds = {};
var packetStates = {toClient: {}, toServer: {}};
(function() {
  for (var stateName in states) {
    var state = states[stateName];

    packetFields[state] = {toClient: [], toServer: []};
    packetNames[state] = {toClient: [], toServer: []};
    packetIds[state] = {toClient: [], toServer: []};

    ['toClient', 'toServer'].forEach(function(direction) {
      for (var name in packets[state][direction]) {
        var info = packets[state][direction][name];
        var id = info.id;
        var fields = info.fields;

        assert(id !== undefined, 'missing id for packet '+name);
        assert(fields !== undefined, 'missing fields for packet '+name);
        assert(!packetNames[state][direction].hasOwnProperty(id), 'duplicate packet id '+id+' for '+name);
        assert(!packetIds[state][direction].hasOwnProperty(name), 'duplicate packet name '+name+' for '+id);
        assert(!packetFields[state][direction].hasOwnProperty(id), 'duplicate packet id '+id+' for '+name);
        assert(!packetStates[direction].hasOwnProperty(name), 'duplicate packet name '+name+' for '+id+', must be unique across all states');

        packetNames[state][direction][id] = name;
        packetIds[state][direction][name] = id;
        packetFields[state][direction][id] = fields;
        packetStates[direction][name] = state;
      }
    });
  }
})();



var types = {
  'byte': [readByte, writeByte, 1],
  'ubyte': [readUByte, writeUByte, 1],
  'short': [readShort, writeShort, 2],
  'ushort': [readUShort, writeUShort, 2],
  'int': [readInt, writeInt, 4],
  'long': [readLong, writeLong, 8],
  'varint': [readVarInt, writeVarInt, sizeOfVarInt],
  'float': [readFloat, writeFloat, 4],
  'double': [readDouble, writeDouble, 8],
  'bool': [readBool, writeBool, 1],
  'string': [readString, writeString, sizeOfString],
  'ustring': [readString, writeString, sizeOfUString], // TODO : remove ustring
  'UUID': [readUUID, writeUUID, 16],
  'container': [readContainer, writeContainer, sizeOfContainer],
  'array': [readArray, writeArray, sizeOfArray],
  'buffer': [readBuffer, writeBuffer, sizeOfBuffer],
  'count': [readCount, writeCount, sizeOfCount],
  // TODO : remove type-specific, replace with generic containers and arrays.
  'slot': [readSlot, writeSlot, sizeOfSlot],
  'entityMetadata': [readEntityMetadata, writeEntityMetadata, sizeOfEntityMetadata],
};

var debug;
if (process.env.NODE_DEBUG && /(minecraft-protocol|mc-proto)/.test(process.env.NODE_DEBUG)) {
  var pid = process.pid;
  debug = function(x) {
    // if console is not set up yet, then skip this.
    if (!console.error)
      return;
    console.error('MC-PROTO: %d', pid,
                  util.format.apply(util, arguments).slice(0, 500));
  };
} else {
  debug = function() { };
}

var entityMetadataTypes = {
  0: { type: 'byte' },
  1: { type: 'short' },
  2: { type: 'int' },
  3: { type: 'float' },
  4: { type: 'string' },
  5: { type: 'slot' },
  6: { type: 'container', typeArgs: { fields: [
       { name: 'x', type: 'int' },
       { name: 'y', type: 'int' },
       { name: 'z', type: 'int' }
  ]}}
};

// maps string type name to number
var entityMetadataTypeBytes = {};
for (var n in entityMetadataTypes) {
  if (!entityMetadataTypes.hasOwnProperty(n)) continue;

  entityMetadataTypeBytes[entityMetadataTypes[n].type] = n;
}

function sizeOfEntityMetadata(value) {
  var size = 1 + value.length;
  var item;
  for (var i = 0; i < value.length; ++i) {
    item = value[i];
    size += sizeOf(item.value, entityMetadataTypes[entityMetadataTypeBytes[item.type]], {});
  }
  return size;
}

function writeEntityMetadata(value, buffer, offset) {
  value.forEach(function(item) {
    var type = entityMetadataTypeBytes[item.type];
    var headerByte = (type << 5) | item.key;
    buffer.writeUInt8(headerByte, offset);
    offset += 1;
    offset = write(item.value, buffer, offset, entityMetadataTypes[type], {});
  });
  buffer.writeUInt8(0x7f, offset);
  return offset + 1;
}

function writeUUID(value, buffer, offset) {
  buffer.writeInt32BE(value[0], offset);
  buffer.writeInt32BE(value[1], offset + 4);
  buffer.writeInt32BE(value[2], offset + 8);
  buffer.writeInt32BE(value[3], offset + 12);
  return offset + 16;
}

function readEntityMetadata(buffer, offset) {
  var cursor = offset;
  var metadata = [];
  var item, key, type, results, reader, typeName, dataType;
  while (true) {
    if (cursor + 1 > buffer.length) return null;
    item = buffer.readUInt8(cursor);
    cursor += 1;
    if (item === 0x7f) {
      return {
        value: metadata,
        size: cursor - offset,
      };
    }
    key = item & 0x1f;
    type = item >> 5;
    dataType = entityMetadataTypes[type];
    debug("Reading entity metadata type " + dataType + " (" + ( typeName || "unknown" ) + ")");
    if (!dataType) {
      return {
        error: new Error("unrecognized entity metadata type " + type)
      }
    }
    results = read(buffer, cursor, dataType, {});
    if (! results) return null;
    metadata.push({
      key: key,
      value: results.value,
      type: typeName,
    });
    cursor += results.size;
  }
}

function readString (buffer, offset) {
  var length = readVarInt(buffer, offset);
  if (!!!length) return null;
  var cursor = offset + length.size;
  var stringLength = length.value;
  var strEnd = cursor + stringLength;
  if (strEnd > buffer.length) return null;
  
  var value = buffer.toString('utf8', cursor, strEnd);
  cursor = strEnd;
  
  return {
    value: value,
    size: cursor - offset,
  };
}

function readUUID(buffer, offset) {
  return {
    value: [
      buffer.readInt32BE(offset),
      buffer.readInt32BE(offset + 4),
      buffer.readInt32BE(offset + 8),
      buffer.readInt32BE(offset + 12),
    ],
    size: 16,
  };
}

function readShort(buffer, offset) {
  if (offset + 2 > buffer.length) return null;
  var value = buffer.readInt16BE(offset);
  return {
    value: value,
    size: 2,
  };
}

function readUShort(buffer, offset) {
  if (offset + 2 > buffer.length) return null;
  var value = buffer.readUInt16BE(offset);
  return {
    value: value,
    size: 2,
  };
}

function readInt(buffer, offset) {
  if (offset + 4 > buffer.length) return null;
  var value = buffer.readInt32BE(offset);
  return {
    value: value,
    size: 4,
  };
}

function readFloat(buffer, offset) {
  if (offset + 4 > buffer.length) return null;
  var value = buffer.readFloatBE(offset);
  return {
    value: value,
    size: 4,
  };
}

function readDouble(buffer, offset) {
  if (offset + 8 > buffer.length) return null;
  var value = buffer.readDoubleBE(offset);
  return {
    value: value,
    size: 8,
  };
}

function readLong(buffer, offset) {
  if (offset + 8 > buffer.length) return null;
  return {
    value: [buffer.readInt32BE(offset), buffer.readInt32BE(offset + 4)],
    size: 8,
  };
}

function readByte(buffer, offset) {
  if (offset + 1 > buffer.length) return null;
  var value = buffer.readInt8(offset);
  return {
    value: value,
    size: 1,
  };
}

function readUByte(buffer, offset) {
  if (offset + 1 > buffer.length) return null;
  var value = buffer.readUInt8(offset);
  return {
    value: value,
    size: 1,
  };
}

function readBool(buffer, offset) {
  if (offset + 1 > buffer.length) return null;
  var value = buffer.readInt8(offset);
  return {
    value: !!value,
    size: 1,
  };
}

function readSlot(buffer, offset) {
  var results = readShort(buffer, offset);
  if (! results) return null;
  var blockId = results.value;
  var cursor = offset + results.size;

  if (blockId === -1) {
    return {
      value: { id: blockId },
      size: cursor - offset,
    };
  }

  var cursorEnd = cursor + 5;
  if (cursorEnd > buffer.length) return null;
  var itemCount = buffer.readInt8(cursor);
  var itemDamage = buffer.readInt16BE(cursor + 1);
  var nbtDataSize = buffer.readInt16BE(cursor + 3);
  if (nbtDataSize === -1) nbtDataSize = 0;
  var nbtDataEnd = cursorEnd + nbtDataSize;
  if (nbtDataEnd > buffer.length) return null;
  var nbtData = buffer.slice(cursorEnd, nbtDataEnd);

  return {
    value: {
      id: blockId,
      itemCount: itemCount,
      itemDamage: itemDamage,
      nbtData: nbtData,
    },
    size: nbtDataEnd - offset,
  };
}

function sizeOfSlot(value) {
  return value.id === -1 ? 2 : 7 + value.nbtData.length;
}

function writeSlot(value, buffer, offset) {
  buffer.writeInt16BE(value.id, offset);
  if (value.id === -1) return offset + 2;
  buffer.writeInt8(value.itemCount, offset + 2);
  buffer.writeInt16BE(value.itemDamage, offset + 3);
  var nbtDataSize = value.nbtData.length;
  if (nbtDataSize === 0) nbtDataSize = -1; // I don't know wtf mojang smokes
  buffer.writeInt16BE(nbtDataSize, offset + 5);
  value.nbtData.copy(buffer, offset + 7);
  return offset + 7 + value.nbtData.length;
}

function sizeOfString(value) {
  var length = Buffer.byteLength(value, 'utf8');
  assert.ok(length < STRING_MAX_LENGTH, "string greater than max length");
  return sizeOfVarInt(length) + length;
}

function sizeOfUString(value) {
  var length = Buffer.byteLength(value, 'utf8');
  assert.ok(length < SRV_STRING_MAX_LENGTH, "string greater than max length");
  return sizeOfVarInt(length) + length;
}

function writeString(value, buffer, offset) {
  var length = Buffer.byteLength(value, 'utf8');
  offset = writeVarInt(length, buffer, offset);
  buffer.write(value, offset, length, 'utf8');
  return offset + length;
}

function writeByte(value, buffer, offset) {
  buffer.writeInt8(value, offset);
  return offset + 1;
}

function writeBool(value, buffer, offset) {
  buffer.writeInt8(+value, offset);
  return offset + 1;
}

function writeUByte(value, buffer, offset) {
  buffer.writeUInt8(value, offset);
  return offset + 1;
}

function writeFloat(value, buffer, offset) {
  buffer.writeFloatBE(value, offset);
  return offset + 4;
}

function writeDouble(value, buffer, offset) {
  buffer.writeDoubleBE(value, offset);
  return offset + 8;
}

function writeShort(value, buffer, offset) {
  buffer.writeInt16BE(value, offset);
  return offset + 2;
}

function writeUShort(value, buffer, offset) {
  buffer.writeUInt16BE(value, offset);
  return offset + 2;
}

function writeInt(value, buffer, offset) {
  buffer.writeInt32BE(value, offset);
  return offset + 4;
}

function writeLong(value, buffer, offset) {
  buffer.writeInt32BE(value[0], offset);
  buffer.writeInt32BE(value[1], offset + 4);
  return offset + 8;
}

function readVarInt(buffer, offset) {
  var result = 0;
  var shift = 0;
  var cursor = offset;
    
  while (true) {
    if (cursor + 1 > buffer.length) return null;
    var b = buffer.readUInt8(cursor);
    result |= ((b & 0x7f) << shift); // Add the bits to our number, except MSB
    cursor++;
    if (!(b & 0x80)) { // If the MSB is not set, we return the number
      return {
        value: result,
        size: cursor - offset
      };
    }
    shift += 7; // we only have 7 bits, MSB being the return-trigger
    assert.ok(shift < 64, "varint is too big"); // Make sure our shift don't overflow.
  }
}

function sizeOfVarInt(value) {
  var cursor = 0;
  while (value & ~0x7F) {
    value >>>= 7;
    cursor++;
  }
  return cursor + 1;
}

function writeVarInt(value, buffer, offset) {
  var cursor = 0;
  while (value & ~0x7F) {
    buffer.writeUInt8((value & 0xFF) | 0x80, offset + cursor);
    cursor++;
    value >>>= 7;
  }
  buffer.writeUInt8(value, offset + cursor);
  return offset + cursor + 1;
}

function readContainer(buffer, offset, typeArgs, rootNode) {
    var results = {
        value: {},
        size: 0
    };
    // BLEIGH. Huge hack because I have no way of knowing my current name.
    // TODO : either pass fieldInfo instead of typeArgs as argument (bleigh), or send name as argument (verybleigh).
    rootNode.this = results.value;
    for (var index in typeArgs.fields) {
        var readResults = read(buffer, offset, typeArgs.fields[index], rootNode);
        results.size += readResults.size;
        offset += readResults.size;
        results.value[typeArgs.fields[index].name] = readResults.value;
    }
    delete rootNode.this;
    return results;
}

function writeContainer(value, buffer, offset, typeArgs, rootNode) {
    rootNode.this = value;
    for (var index in typeArgs.fields) {
        offset = write(value[typeArgs.fields[index].name], buffer, offset, typeArgs.fields[index], rootNode);
    }
    delete rootNode.this;
    return offset;
}

function sizeOfContainer(value, typeArgs, rootNode) {
    var size = 0;
    rootNode.this = value;
    for (var index in typeArgs.fields) {
        size += sizeOf(value[typeArgs.fields[index].name], typeArgs.fields[index], rootNode);
    }
    delete rootNode.this;
    return size;
}

function readBuffer(buffer, offset, typeArgs, rootNode) {    
    var count = getField(typeArgs.count, rootNode);
    return {
        value: buffer.slice(offset, offset + count),
        size: count
    };
}

function writeBuffer(value, buffer, offset) {
    value.copy(buffer, offset);
    return offset + value.length;
}

function sizeOfBuffer(value) {
    return value.length;
}

function readArray(buffer, offset, typeArgs, rootNode) {
    var results = {
        value: [],
        size: 0
    }
    var count = getField(typeArgs.count, rootNode);
    for (var i = 0; i < count; i++) {
        var readResults = read(buffer, offset, { type: typeArgs.type, typeArgs: typeArgs.typeArgs }, rootNode);
        results.size += readResults.size;
        offset += readResults.size;
        results.value.push(readResults.value);
    }
    return results;
}

function writeArray(value, buffer, offset, typeArgs, rootNode) {
    for (var index in value) {
        offset = write(value[index], buffer, offset, { type: typeArgs.type, typeArgs: typeArgs.typeArgs }, rootNode);
    }
    return offset;
}

function sizeOfArray(value, typeArgs, rootNode) {
    var size = 0;
    for (var index in value) {
        size += sizeOf(value[index], { type: typeArgs.type, typeArgs: typeArgs.typeArgs }, rootNode);
    }
    return size;
}

function getField(countField, rootNode) {
    var countFieldArr = countField.split(".");
    var count = rootNode;
    for (var index in countFieldArr) {
        count = count[countFieldArr[index]];
    }
    return count;
}

function readCount(buffer, offset, typeArgs, rootNode) {
    return read(buffer, offset, { type: typeArgs.type }, rootNode);
}

function writeCount(value, buffer, offset, typeArgs, rootNode) {
    // Actually gets the required field, and writes its length. Value is unused.
    // TODO : a bit hackityhack.
    return write(getField(typeArgs.countFor, rootNode).length, buffer, offset, { type: typeArgs.type }, rootNode);
}

function sizeOfCount(value, typeArgs, rootNode) {
    // TODO : should I use value or getField().length ?
    /*console.log(rootNode);
    console.log(typeArgs);*/
    return sizeOf(getField(typeArgs.countFor, rootNode).length, { type: typeArgs.type }, rootNode);
}

function read(buffer, cursor, fieldInfo, rootNodes) {
  if (fieldInfo.condition && !fieldInfo.condition(rootNodes)) {
    return null;
  }
  var type = types[fieldInfo.type];
  if (!type) {
    return {
      error: new Error("missing data type: " + fieldInfo.type)
    };
  }
  var readResults = type[0](buffer, cursor, fieldInfo.typeArgs, rootNodes);
  if (readResults.error) return { error: readResults.error };
  return readResults;
}

function write(value, buffer, offset, fieldInfo, rootNode) {
  if (fieldInfo.condition && !fieldInfo.condition(rootNode)) {
    return null;
  }
  var type = types[fieldInfo.type];
  if (!type) {
    return {
      error: new Error("missing data type: " + fieldInfo.type)
    };
  }
  return type[1](value, buffer, offset, fieldInfo.typeArgs, rootNode);
}

function sizeOf(value, fieldInfo, rootNode) {
  if (fieldInfo.condition && !fieldInfo.condition(rootNode)) {
    return 0;
  }
  var type = types[fieldInfo.type];
  if (!type) {
    throw new Error("missing data type: " + fieldInfo.type);
  }
  if (typeof type[2] === 'function') {
    return type[2](value, fieldInfo.typeArgs, rootNode);
  } else {
    return type[2];
  }
}

function get(packetId, state, toServer) {
  var direction = toServer ? "toServer" : "toClient";
  var packetInfo = packetFields[state][direction][packetId];
  if (!packetInfo) {
    return null;
  }
  return packetInfo;
}

function createPacketBuffer(packetId, state, params, isServer) {
  var length = 0;
  if (typeof packetId === 'string' && typeof state !== 'string' && !params) {
    // simplified two-argument usage, createPacketBuffer(name, params)
    params = state;
    state = packetStates[!isServer ? 'toServer' : 'toClient'][packetId];
  }
  if (typeof packetId === 'string') packetId = packetIds[state][!isServer ? 'toServer' : 'toClient'][packetId];
  assert.notEqual(packetId, undefined);

  var packet = get(packetId, state, !isServer);
  assert.notEqual(packet, null);
  packet.forEach(function(fieldInfo) {
    length += sizeOf(params[fieldInfo.name], fieldInfo, params);
  });
  length += sizeOfVarInt(packetId);
  var size = length + sizeOfVarInt(length);
  var buffer = new Buffer(size);
  var offset = writeVarInt(length, buffer, 0);
  offset = writeVarInt(packetId, buffer, offset);
  packet.forEach(function(fieldInfo) {
    var value = params[fieldInfo.name];
    if(typeof value === "undefined") value = 0; // TODO : Why ?
    offset = write(value, buffer, offset, fieldInfo, params);
  });
  return buffer;
}

function parsePacket(buffer, state, isServer, packetsToParse) {
  if (state == null) state == states.PLAY;
  var cursor = 0;
  var lengthField = readVarInt(buffer, 0);
  if (!!!lengthField) return null;
  var length = lengthField.value;
  cursor += lengthField.size;
  if (length + lengthField.size > buffer.length) return null;
  var buffer = buffer.slice(0, length + cursor); // fail early if too much is read.
  
  var packetIdField = readVarInt(buffer, cursor);
  var packetId = packetIdField.value;
  cursor += packetIdField.size;
  
  var results = { id: packetId };
  // Only parse the packet if there is a need for it, AKA if there is a listener attached to it
  var name = packetNames[state][isServer ? "toServer" : "toClient"][packetId];
  var shouldParse = (!packetsToParse.hasOwnProperty(name) || packetsToParse[name] <= 0)
                    && (!packetsToParse.hasOwnProperty("packet") || packetsToParse["packet"] <= 0);
  if (shouldParse) {
    return {
        size: length + lengthField.size,
        buffer: buffer,
        results: results
    };
  }
  
  var packetInfo = get(packetId, state, isServer);
  if (packetInfo === null) {
    return {
      error: new Error("Unrecognized packetId: " + packetId + " (0x" + packetId.toString(16) + ")"),
      size: length + lengthField.size,
      buffer: buffer,
      results: results
    };
  } else {
    debug("read packetId " + packetId + " (0x" + packetId.toString(16) + ")");
  }
  
  var i, fieldInfo, readResults;
  for (i = 0; i < packetInfo.length; ++i) {
    fieldInfo = packetInfo[i];
    readResults = read(buffer, cursor, fieldInfo, results);
    /* A deserializer cannot return null anymore. Besides, read() returns
     * null when the condition is not fulfilled.
     if (!!!readResults) {
        var error = new Error("A deserializer returned null");
        error.packetId = packetId;
        error.fieldInfo = fieldInfo.name;
        return {
            size: length + lengthField.size,
            error: error,
            results: results
        };
    }*/
    if (readResults === null) continue;
    if (readResults.error) {
      return readResults;
    }
    results[fieldInfo.name] = readResults.value;
    cursor += readResults.size;
  }
  debug(results);
  return {
    size: length + lengthField.size,
    results: results,
    buffer: buffer
  };
}

module.exports = {
  version: 5,
  minecraftVersion: '1.7.6',
  sessionVersion: 13,
  parsePacket: parsePacket,
  createPacketBuffer: createPacketBuffer,
  STRING_MAX_LENGTH: STRING_MAX_LENGTH,
  packetIds: packetIds,
  packetNames: packetNames,
  packetFields: packetFields,
  packetStates: packetStates,
  states: states,
  get: get,
  debug: debug,
};
