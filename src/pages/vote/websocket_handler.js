import Cookies from "js-cookie";

class WebSocketHandler {
  handlers = [];
  connected = false;

  connect() {
    if (this.connected) {
      return;
    }
    let port = window.location.port;
    const protocol = window.location.protocol === "http:" ? "ws" : "wss";
    const token = Cookies.get("token");
    this.socket = new WebSocket(
        `${protocol}://${window.location.hostname}:${port}/ws`
    );
    this.socket.onopen = () => {
      this.socket.send(JSON.stringify({ type: "auth", token: token }));
      this.connected = true;
      console.log("web socket connected!");
    };
    this.socket.onclose = () => {
      this.connected = false;
      console.log("web socket disconnected");
    };
    this.socket.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        this.receiveEvent(event);
      } catch (err) {
        console.error("error parsing message:", err);
      }
    };
  }

  addOption(room, optionText) {
    this.socket.send(JSON.stringify({ type: "new_option", room, optionText }));
  }

  removeOption(room, optionText) {
    this.socket.send(JSON.stringify({ type: "remove_option", room, optionText }));
  }

  lockIn(room, vote) {
    this.socket.send(JSON.stringify({ type: "lock_in", room, vote }));
  }

  closeRoom(room) {
    this.socket.send(JSON.stringify({ type: "close_room", room }));
  }

  unlockVote(room) {
    this.socket.send(JSON.stringify({ type: "unlock_vote", room }));
  }

  startNextRound(room) {
    this.socket.send(JSON.stringify({ type: "start_next_round", room }));
  }

  addHandler(handler) {
    this.handlers.push(handler);
  }

  removeHandler(handler) {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  receiveEvent(event) {
    this.handlers.forEach((handler) => {
      handler(event);
    });
  }
}

const WSHandler = new WebSocketHandler();
export { WSHandler };