// Prints the Overpass query for București + Ilfov (what scripts/osm-kinds.mjs keeps). Used by .github/workflows/osm.yml.
import { overpassQuery } from './osm-kinds.mjs';
process.stdout.write(overpassQuery(process.argv[2]));
