export class WebSocketMessage {
    
    context:string = ""; //This is a unique context/ID for a stream of messages.
    type:string = ""; //The type of message within this context (arbitrary)
    message:any = ""; //The actual data/message/payload
    params:any = ""; //Optional extra data to send along, usually a key/value object
    
    constructor(context, type = "", message = "", params = {}) {
        this.context = context;
        this.type = type;
        this.message = message;
        this.params = params;
    }

    toJSON() {
        return JSON.stringify({
            context: this.context,
            type: this.type,
            message: this.message,
            params: this.params
        });
    }
}