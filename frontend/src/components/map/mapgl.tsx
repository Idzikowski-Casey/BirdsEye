import "regenerator-runtime/runtime";
import React, { useRef, useEffect, useState, useContext } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import mapboxgl from "mapbox-gl";
import { AppContext } from "../../context";
import { MapNavBar, AppToaster } from "../blueprint";
import { PropertyDialog } from "../editor";
import { ImportDialog } from "../importer";
import { locationFromHash } from "./utils";
import "./map.css";
import {
  initializeMap,
  propertyViewMap,
  editModeMap,
  MapToolsControl,
  voronoiModeMap,
} from "./map-pieces";
import { onSaveLines } from "./fetch-post";

export enum MAP_MODES {
  topology,
  properties,
  voronoi,
}

/**
 *
 * For delete point, feature.removeCoordinate()
 *
 *
 * For the "preview" mode. Add layer, fill will be based on property. Hover would be nice touch. Then popup
 *
 */

mapboxgl.accessToken =
  "pk.eyJ1IjoidGhlZmFsbGluZ2R1Y2siLCJhIjoiY2tsOHAzeDZ6MWtsaTJ2cXhpMDAxc3k5biJ9.FUMK57K0UP7PSrTUi3DiFQ";

export function Map() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef();
  const drawRef = useRef();
  const voronoiRef = useRef();

  const { state, runAction, updateLinesAndColumns } = useContext(AppContext);

  const [viewport, setViewport] = useState(
    locationFromHash(window.location.hash)
  );

  const [mode, setMode] = useState<MAP_MODES>(MAP_MODES.properties);
  const [legendColumns, setLegendColumns] = useState([]);
  const [changeSet, setChangeSet] = useState([]);
  const [open, setOpen] = useState(false);
  const [features, setFeatures] = useState([]);

  const closeOpen = () => {
    setFeatures([]);
    setOpen(false);
  };

  const changeMode = (mode: MAP_MODES) => {
    setMode(mode);
  };

  const addToChangeSet = (obj) => {
    setChangeSet((prevState) => {
      return [...prevState, ...new Array(obj)];
    });
  };

  const onSave = async () => {
    // can do cleaning on changeSet by the internal id string.
    // Combine like edits so I'm not running a million
    // transactions on the db.
    if (changeSet.length != 0) {
      runAction({ type: "is-saving", payload: { isSaving: true } });
      await onSaveLines(changeSet, state.project.project_id);
      updateLinesAndColumns(state.project.project_id);
      runAction({ type: "is-saving", payload: { isSaving: false } });
      setChangeSet([]);
    }
  };

  const onCancel = () => {
    AppToaster.show({
      message: "Undoing all Changes...",
      intent: "warning",
      timeout: 1000,
    });
    setChangeSet([]);
    updateLinesAndColumns(state.project.project_id);
  };

  useEffect(() => {
    if (mapContainerRef.current == null) return;
    initializeMap(
      mapContainerRef.current,
      viewport,
      addToChangeSet,
      setViewport
    ).then((mapObj) => {
      mapRef.current = mapObj;
    });
    return () => {
      mapRef.current.remove();
    };
  }, [mapContainerRef]);

  useEffect(() => {
    if (mapRef.current == null) return;
    const edit = mode == MAP_MODES.topology;
    if (edit) {
      const map = mapRef.current;

      let draw = editModeMap(map, state);
      drawRef.current = draw;
      return () => {
        console.log("Removing Topology Mode");
        let map = mapRef.current;
        let Draw = drawRef.current;
        if (!map || !Draw || !edit) return;
        try {
          Draw.onRemove();
        } catch (error) {
          console.log(error);
        }
      };
    }
  }, [state.lines, mode, mapRef]);

  useEffect(() => {
    if (mapRef.current == null) return;
    const isVoronoiMode = mode == MAP_MODES.voronoi;
    if (isVoronoiMode) {
      const map = mapRef.current;
      let draw = voronoiModeMap(map, state);
      voronoiRef.current = draw;
      return () => {
        let map = mapRef.current;
        let Draw = voronoiRef.current;
        if (!map || !Draw || !isVoronoiMode) return;
        try {
          Draw.onRemove();
        } catch (error) {
          console.log(error);
        }
      };
    }
  }, [mode, mapRef]);

  useEffect(() => {
    if (mapRef.current == null) return;
    if (mode == MAP_MODES.properties) {
      propertyViewMap(
        mapRef.current,
        state,
        features,
        setFeatures,
        setOpen,
        setLegendColumns
      );
      return () => {
        var mapLayer = mapRef.current.getLayer("column-fill");
        if (typeof mapLayer !== "undefined") {
          mapRef.current.removeLayer("column-fill");
          mapRef.current.removeLayer("outline");
          mapRef.current.removeSource("columns");
        }
      };
    }
  }, [state.columns, mode, mapRef]);

  const mapToolsClassName =
    mode == MAP_MODES.topology
      ? "map-tools-control-left"
      : "map-tools-control-right";

  console.log("features", features);
  return (
    <div>
      <ImportDialog />
      <div>
        <MapNavBar
          onSave={onSave}
          onCancel={onCancel}
          changeMode={changeMode}
          mode={mode}
          project_id={state.project.project_id}
        />
      </div>

      <div>
        <div className="map-container" ref={mapContainerRef} />
      </div>
      <div className={mapToolsClassName}>
        <MapToolsControl
          draw={drawRef.current}
          addToChangeSet={addToChangeSet}
          columns={legendColumns}
          editMode={mode == MAP_MODES.topology}
        />
      </div>
      {mode == MAP_MODES.topology ? null : (
        <div>
          <PropertyDialog
            open={open}
            features={features}
            setFeatures={setFeatures}
            closeOpen={closeOpen}
          />
        </div>
      )}
    </div>
  );
}

export const M = "Mapbobgl";
