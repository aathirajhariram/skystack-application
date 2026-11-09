from skyframe.extraction.auto_extractor import AutoExtractor
from skyframe.extraction.csv_extractor import CsvExtractor
from skyframe.extraction.erp_sap_extractor import SapFlatExtractor
from skyframe.extraction.erp_tally_extractor import TallyXmlExtractor
from skyframe.extraction.excel_extractor import ExcelExtractor
from skyframe.extraction.fixed_width_extractor import FixedWidthExtractor
from skyframe.extraction.json_extractor import JsonExtractor
from skyframe.extraction.xml_extractor import XmlExtractor

# To support a new file type: write one extractor class and register it here.
EXTRACTORS = {
    "AUTO": AutoExtractor,
    "CSV": CsvExtractor,
    "EXCEL": ExcelExtractor,
    "JSON": JsonExtractor,
    "XML": XmlExtractor,
    "FIXED_WIDTH": FixedWidthExtractor,
    "ERP_TALLY_XML": TallyXmlExtractor,
    "ERP_SAP_FLAT": SapFlatExtractor,
}


def get_extractor(file_format: str, spark, options: dict):
    try:
        return EXTRACTORS[file_format.upper()](spark, options)
    except KeyError:
        raise ValueError(f"Unsupported file format '{file_format}'. Supported: {sorted(EXTRACTORS)}")
