from skyframe.extraction.xml_extractor import XmlExtractor


class TallyXmlExtractor(XmlExtractor):
    """Tally Prime / ERP 9 XML exports (Day Book, Vouchers). Each <VOUCHER> is one row.
    Typical columns after flattening: DATE, VOUCHERTYPENAME, VOUCHERNUMBER, PARTYLEDGERNAME,
    LEDGERENTRIES.LIST_LEDGERNAME, LEDGERENTRIES.LIST_AMOUNT ...  Map them in cfg.ColumnMapping."""

    default_record_tag = "VOUCHER"
