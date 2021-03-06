import React, { createContext, useContext, useState, useEffect } from "react";
import {
  Overlay,
  Button,
  Card,
  Navbar,
  FormGroup,
  Collapse,
} from "@blueprintjs/core";
import { OverlayBox, SaveButton } from "../../blueprint";
import { useAPIResult, useModelEditor } from "@macrostrat/ui-components";
import { ColumnSuggest } from "./column-suggest";
import { NewColGroups } from "./new-column";
import { AppContext } from "../../../context";
import { base } from "../../../context/env";
import { EditColGroup } from ".";

function unwrapColumnGroups(res) {
  const { data } = res;
  return data;
}

function ColumnGroup() {
  const { model, isEditing, actions } = useModelEditor();
  const { state } = useContext(AppContext);
  const [open, setOpen] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const { project } = state;
  const { project_id } = project;

  const data = useAPIResult(
    base + `${project_id}/col-groups`,
    {},
    { unwrapResponse: unwrapColumnGroups }
  );

  if (!data) return <div />;

  const { col_group, col_group_name, col_group_id } = model;

  const onChangeGroup = (e) => {
    actions.updateState({
      model: {
        col_group: { $set: e.col_group },
        col_group_id: { $set: e.col_group_id },
        col_group_name: { $set: e.col_group_name },
      },
    });
  };

  const onCreateColGroup = (col_group_id, col_group, col_group_name) => {
    setOpen(false);
    actions.updateState({
      model: {
        col_group: { $set: col_group },
        col_group_id: { $set: col_group_id },
        col_group_name: { $set: col_group_name },
      },
    });
  };

  if (isEditing) {
    return (
      <div>
        <div className="edit-with-label">
          <h4 className="h4-0">Column Group: </h4>
          <ColumnSuggest
            items={data}
            onChange={onChangeGroup}
            initialItem={model}
          />
        </div>
        <div style={{ margin: "10px", marginLeft: "0px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Button
              onClick={() => {
                setOpen(!open);
              }}
              intent="success"
            >
              New Column Group
            </Button>
            <Button
              onClick={() => {
                setOpenEdit(!openEdit);
              }}
              disabled={model.col_group_id == undefined ? true : false}
              intent="success"
            >
              Edit Column Group
            </Button>
          </div>
        </div>
        <Collapse isOpen={open}>
          <div className="new-column-collapse">
            <NewColGroups onCreate={onCreateColGroup} />
          </div>
        </Collapse>
        <Collapse isOpen={openEdit}>
          <div className="new-column-collapse">
            <EditColGroup onCreate={onCreateColGroup} state={model} />
          </div>
        </Collapse>
      </div>
    );
  }
  return (
    <div>
      <h4>Column Group: {col_group}</h4>
      <h4>Column Group Name: {col_group_name}</h4>
    </div>
  );
}

export { ColumnGroup };
