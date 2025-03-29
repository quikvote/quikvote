import React from "react";
import { useParams } from "react-router-dom";
import { WSHandler } from "./websocket_handler";

export default function RemoveOptionButton({ isRoomOwner, disabled, option }) {
  const { id } = useParams();

  async function removeOption() {
    WSHandler.removeOption(id, option);
  }

  return (
    <>
      {isRoomOwner && !disabled &&
        <button
          className='delete__button'
          onClick={() => removeOption()}
        >
          <span className="material-symbols-outlined">delete</span>
        </button>
      }
    </>
  )
}
